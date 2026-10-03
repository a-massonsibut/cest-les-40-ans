/***************
 * CONFIG GÉNÉRALE
 ***************/
const SPREADSHEET_ID = '1BCClj5J-HL5MSjtstgmkk3M8NQsAFZ3gwh4_kraslY8';
const TIMEZONE = 'Europe/Paris';

const QR_SHEET_NAME = 'QR_codes';
const RESULTS_SHEET_NAME = 'Resultats';

const RESULT_HEADERS = ['Nom', 'Résultat', 'QR_codes_scannés', 'Dernier_scan'];

const MAX_CODE = 120;
const MAX_NAME = 40;
const MAX_DESC = 200;

// Cache de la liste des QR codes. CacheService persiste entre les requêtes,
// contrairement aux variables globales d'une web app qui sont réinitialisées
// à chaque invocation (nouvel environnement V8).
const QR_MAP_CACHE_KEY = 'qr_map_v1';
const QR_MAP_CACHE_TTL_SECONDS = 300;

/***************
 * ROUTEUR GET
 ***************/
function doGet(e) {
  const params = e.parameter || {};
  const action = clean(params.action, 30);

  try {
    if (action === 'lookup') return qrLookup(params);
    if (action === 'status')  return qrStatus(params);
    if (action === 'flush')   return qrFlushCache();

    return json({ success: true, message: 'Apps Script QR actif' });
  } catch (error) {
    return json({ success: false, error: String(error) });
  }
}

// Vide le cache de la liste des QR codes. À appeler après avoir modifié les
// points ou ajouté des QR codes dans le Sheet :
//   GET https://script.google.com/macros/s/.../exec?action=flush
function qrFlushCache() {
  CacheService.getScriptCache().remove(QR_MAP_CACHE_KEY);
  return json({ success: true, flushed: true });
}

/***************
 * ROUTEUR POST
 ***************/
function doPost(e) {
  const params = e.parameter || {};
  const action = clean(params.action, 30);

  try {
    if (action === 'scan') return qrScan(e);
    return json({ success: false, error: 'unknown_action' });
  } catch (error) {
    return json({ success: false, error: String(error) });
  }
}

/***************
 * QR — LOOKUP
 ***************/
function qrLookup(params) {
  const qr = findQrCode(clean(params.code, MAX_CODE));

  return jsonp(params, {
    success: true,
    valid: Boolean(qr),
    points: qr ? qr.points : 0,
    description: qr ? qr.description : ''
  });
}

/***************
 * QR — STATUS
 ***************/
function qrStatus(params) {
  const participant = clean(params.participant, MAX_NAME);
  return jsonp(params, getStatusPayload(participant));
}

/***************
 * QR — SCAN
 ***************/
function qrScan(e) {
  const params = e.parameter || {};
  const participant = clean(params.participant, MAX_NAME);
  const code = clean(params.code, MAX_CODE);

  if (!participant || !code) {
    return json({ success: false, error: 'missing_fields' });
  }

  // Lectures seules, faites HORS du lock : le lock global ne doit servir
  // qu'à la lecture-modification-écriture de la feuille Resultats.
  const qr = findQrCode(code);
  if (!qr) {
    return json({ success: false, error: 'unknown_qr_code' });
  }
  const resultsSheet = getResultsSheet();
  const date = nowString();

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    ensureResultHeaders(resultsSheet);

    const rows = getResultRows(resultsSheet, true);
    const idx = rows.findIndex(r => r.participantKey === normalKey(participant));

    if (idx !== -1) {
      const row = rows[idx];
      if (row.codeSet.has(qr.key)) {
        return json({ success: true, duplicate: true, points: 0, total: row.total });
      }

      const codes = row.codes.concat([qr.code]);
      const total = row.total + qr.points;

      resultsSheet
        .getRange(row.rowNumber, 2, 1, 3)
        .setValues([[total, codes.join(', '), date]]);

      return json({ success: true, duplicate: false, points: qr.points, total: total });
    }

    resultsSheet.appendRow([participant, qr.points, qr.code, date]);

    return json({ success: true, duplicate: false, points: qr.points, total: qr.points });
  } catch (error) {
    return json({ success: false, error: String(error) });
  } finally {
    lock.releaseLock();
  }
}

/***************
 * QR — DONNÉES
 ***************/
function getStatusPayload(participant) {
  const resultsSheet = getResultsSheet();
  ensureResultHeaders(resultsSheet);

  // Pas de getQrCodeMap() ici : le client n'utilise que scan.code et le
  // total. Évite une lecture de la feuille QR_codes à chaque status.
  const rows = getResultRows(resultsSheet, false);

  const participantRow = participant
    ? rows.find(r => r.participantKey === normalKey(participant))
    : null;

  return {
    success: true,
    participant: participant,
    total: participantRow ? participantRow.total : 0,
    scans: participantRow
      ? participantRow.codes.map(code => ({ code: code }))
      : [],
    leaderboard: getLeaderboard(rows)
  };
}

function findQrCode(code) {
  if (!code) return null;
  return getQrCodeMap()[normalKey(code)] || null;
}

function getQrCodeMap() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get(QR_MAP_CACHE_KEY);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (error) {
      // Cache illisible : on le laisse expirer et on relit la feuille.
    }
  }

  const map = buildQrCodeMap();

  // Une map vide n'est pas mise en cache : les QR codes peuvent être
  // ajoutés dans le Sheet à tout moment.
  if (Object.keys(map).length > 0) {
    try {
      cache.put(QR_MAP_CACHE_KEY, JSON.stringify(map), QR_MAP_CACHE_TTL_SECONDS);
    } catch (error) {
      // Map trop volumineuse pour CacheService (~100 Ko) : on continue
      // sans cache, au prix d'une lecture de feuille par requête.
    }
  }

  return map;
}

function buildQrCodeMap() {
  const sheet = getQrSheet();
  const lastRow = sheet.getLastRow();
  const map = {};

  if (lastRow < 2) return map;

  // 4 colonnes fixes (QR_code, Points, Description, Active) : ne lit pas
  // les colonnes fantômes si quelqu'un écrit plus loin dans la feuille.
  const values = sheet.getRange(2, 1, lastRow - 1, 4).getValues();

  for (let i = 0; i < values.length; i++) {
    const rowCode = clean(values[i][0], MAX_CODE);
    if (!rowCode) continue;

    const activeValue = values[i][3];
    const active =
      activeValue === undefined ||
      activeValue === null ||
      activeValue === true ||
      String(activeValue).trim() === '' ||
      String(activeValue).toUpperCase() === 'TRUE';
    if (!active) continue;

    const key = normalKey(rowCode);
    map[key] = {
      key: key,
      code: rowCode,
      points: Number(values[i][1]) || 0,
      description: clean(values[i][2], MAX_DESC)
    };
  }

  return map;
}

function getResultRows(sheet, withCodeSet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const values = sheet.getRange(2, 1, lastRow - 1, 4).getValues();
  const rows = [];

  for (let i = 0; i < values.length; i++) {
    const participant = clean(values[i][0], MAX_NAME);
    if (!participant) continue;

    const codes = parseCodeList(values[i][2]);

    rows.push({
      rowNumber: i + 2,
      participant: participant,
      participantKey: normalKey(participant),
      total: Number(values[i][1]) || 0,
      codes: codes,
      codeSet: withCodeSet ? new Set(codes.map(normalKey)) : null
    });
  }

  return rows;
}

function getLeaderboard(resultRows) {
  return resultRows
    .map(row => ({
      participant: row.participant,
      total: row.total,
      count: row.codes.length
    }))
    .sort((a, b) => b.total - a.total || a.participant.localeCompare(b.participant))
    .slice(0, 20);
}

function ensureResultHeaders(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(RESULT_HEADERS);
  }
}

/***************
 * ACCÈS FEUILLES (mis en cache pour l'invocation en cours)
 *
 * Note : une web app Apps Script démarre un nouvel environnement à chaque
 * requête, ces caches ne vivent donc que le temps d'une seule requête.
 * Le cache qui persiste entre les requêtes est CacheService (voir
 * getQrCodeMap).
 ***************/
function getSpreadsheet() {
  if (!getSpreadsheet._ss) {
    getSpreadsheet._ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  }
  return getSpreadsheet._ss;
}

function getQrSheet() {
  if (!getQrSheet._s) {
    getQrSheet._s = getSpreadsheet().getSheetByName(QR_SHEET_NAME);
    if (!getQrSheet._s) throw new Error('Feuille QR_codes introuvable');
  }
  return getQrSheet._s;
}

function getResultsSheet() {
  if (!getResultsSheet._s) {
    getResultsSheet._s = getSpreadsheet().getSheetByName(RESULTS_SHEET_NAME);
    if (!getResultsSheet._s) throw new Error('Feuille Resultats introuvable');
  }
  return getResultsSheet._s;
}

/***************
 * HELPERS
 ***************/
function nowString() {
  return Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd HH:mm:ss');
}

function parseCodeList(value) {
  return String(value || '')
    .split(/[,;\n]+/)
    .map(code => clean(code, MAX_CODE))
    .filter(Boolean);
}

function formatDateCell(value) {
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return Utilities.formatDate(value, TIMEZONE, 'dd/MM/yyyy HH:mm');
  }
  return clean(value, 40);
}

function sameText(a, b) {
  return normalKey(a) === normalKey(b);
}

function normalKey(value) {
  return String(value || '').trim().toLowerCase();
}

function clean(value, maxLength) {
  return String(value || '')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .trim()
    .slice(0, maxLength);
}

function json(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function jsonp(params, payload) {
  const callback = clean(params.callback, 80);

  if (/^[A-Za-z_$][0-9A-Za-z_$]*$/.test(callback)) {
    return ContentService
      .createTextOutput(callback + '(' + JSON.stringify(payload) + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return json(payload);
}
