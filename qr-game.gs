/***************
 * CONFIG GÉNÉRALE
 *
 * À renseigner pour le NOUVEAU spreadsheet dédié au jeu QR code :
 *   - SPREADSHEET_ID : ID du nouveau spreadsheet (dans son URL).
 *   - QR_SHEET_NAME  : nom de l'onglet contenant la liste des QR codes.
 *   - RESULTS_SHEET_NAME : nom de l'onglet contenant les résultats.
 *
 * Les onglets sont référencés par NOM (et non par GID) : plus simple à
 * configurer sur un spreadsheet neuf, et plus rapide à charger.
 ***************/
const SPREADSHEET_ID = '17N5YJxQmmbHv7IKyeqHqmH7AOJoHJe9kS146kJBsZRw';
const QR_SHEET_NAME = 'QR_codes';
const RESULTS_SHEET_NAME = 'Resultats';
const TIMEZONE = 'Europe/Paris';

const RESULT_HEADERS = ['Nom', 'Résultat', 'QR_codes_scannés', 'Dernier_scan'];

const QR_CACHE_KEY = 'qr_map_v1';
const QR_CACHE_TTL_SECONDS = 300;

/***************
 * ACCÈS SPREADSHEET (lazy, une seule ouverture par exécution)
 ***************/
let _spreadsheet = null;
let _sheetCache = {};

function getSpreadsheet() {
  if (!_spreadsheet) {
    _spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  }
  return _spreadsheet;
}

function getSheetByName(name) {
  if (!_sheetCache[name]) {
    const sheet = getSpreadsheet().getSheetByName(name);
    if (!sheet) {
      throw new Error('Onglet introuvable : ' + name);
    }
    _sheetCache[name] = sheet;
  }
  return _sheetCache[name];
}

function getQrSheet() {
  return getSheetByName(QR_SHEET_NAME);
}

function getResultsSheet() {
  return getSheetByName(RESULTS_SHEET_NAME);
}

/***************
 * ROUTEUR GET
 ***************/
function doGet(e) {
  const params = e.parameter || {};
  const action = clean(params.action, 30);

  try {
    if (action === 'lookup') {
      return qrLookup(params);
    }

    if (action === 'status') {
      return qrStatus(params);
    }

    if (action === 'refresh') {
      invalidateQrCache();
      return jsonp(params, { success: true, refreshed: true });
    }

    return jsonp(params, { success: true, message: 'Apps Script QR actif' });
  } catch (error) {
    return jsonp(params, { success: false, error: String(error) });
  }
}

/***************
 * ROUTEUR POST
 ***************/
function doPost(e) {
  const params = e.parameter || {};
  const action = clean(params.action, 30);

  if (action === 'scan') {
    return qrScan(e);
  }

  return json({ success: false, error: 'unknown_action' });
}

/***************
 * QR — LOOKUP
 ***************/
function qrLookup(params) {
  const qr = findQrCode(clean(params.code, 120));

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
  const participant = clean(params.participant, 40);

  return jsonp(params, getStatusPayload(participant));
}

/***************
 * QR — SCAN
 ***************/
function qrScan(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const params = e.parameter || {};
    const participant = clean(params.participant, 40);
    const code = clean(params.code, 120);

    if (!participant || !code) {
      return json({ success: false, error: 'missing_fields' });
    }

    const qr = findQrCode(code);

    if (!qr) {
      return json({ success: false, error: 'unknown_qr_code' });
    }

    const resultsSheet = getResultsSheet();
    ensureResultHeaders(resultsSheet);

    const resultRows = getResultRows(resultsSheet);
    const existing = resultRows.find(row => sameText(row.participant, participant));

    if (existing && existing.codes.some(scannedCode => sameText(scannedCode, qr.code))) {
      return json({
        success: true,
        duplicate: true,
        points: 0,
        total: existing.total
      });
    }

    const date = Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd HH:mm:ss');

    if (existing) {
      const codes = existing.codes.concat([qr.code]);
      const total = existing.total + qr.points;

      resultsSheet
        .getRange(existing.rowNumber, 2, 1, 3)
        .setValues([[total, formatCodeList(codes), date]]);

      return json({
        success: true,
        duplicate: false,
        points: qr.points,
        total: total
      });
    }

    resultsSheet.appendRow([participant, qr.points, qr.code, date]);

    return json({
      success: true,
      duplicate: false,
      points: qr.points,
      total: qr.points
    });
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

  const qrMap = getQrCodeMap();
  const resultRows = getResultRows(resultsSheet);

  const participantRow = participant
    ? resultRows.find(row => sameText(row.participant, participant))
    : null;

  return {
    success: true,
    participant: participant,
    total: participantRow ? participantRow.total : 0,
    scans: participantRow
      ? participantRow.codes.map(code => scanFromCode(code, participantRow.lastScan, qrMap))
      : [],
    leaderboard: getLeaderboard(resultRows)
  };
}

function scanFromCode(code, date, qrMap) {
  const qr = qrMap[normalKey(code)] || {
    code: code,
    points: 0,
    description: ''
  };

  return {
    code: qr.code,
    points: qr.points,
    description: qr.description,
    date: date
  };
}

function findQrCode(code) {
  if (!code) return null;

  return getQrCodeMap()[normalKey(code)] || null;
}

function getQrCodeMap() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get(QR_CACHE_KEY);

  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (error) {
      // cache corrompu : on reconstruit ci-dessous
    }
  }

  const sheet = getQrSheet();
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return {};
  }

  const values = sheet.getRange(2, 1, lastRow - 1, Math.max(4, sheet.getLastColumn())).getValues();
  const map = {};

  for (let i = 0; i < values.length; i++) {
    const rowCode = clean(values[i][0], 120);

    if (!rowCode) continue;

    const activeValue = values[i][3];

    const active =
      activeValue === undefined ||
      activeValue === null ||
      activeValue === true ||
      String(activeValue).trim() === '' ||
      String(activeValue).toUpperCase() === 'TRUE';

    if (!active) continue;

    map[normalKey(rowCode)] = {
      code: rowCode,
      points: Number(values[i][1]) || 0,
      description: clean(values[i][2], 200)
    };
  }

  try {
    cache.put(QR_CACHE_KEY, JSON.stringify(map), QR_CACHE_TTL_SECONDS);
  } catch (error) {
    // mise en cache impossible : on continue avec la map en mémoire
  }

  return map;
}

function invalidateQrCache() {
  CacheService.getScriptCache().remove(QR_CACHE_KEY);
}

function getResultRows(sheet) {
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) return [];

  const values = sheet
    .getRange(2, 1, lastRow - 1, Math.max(4, sheet.getLastColumn()))
    .getValues();

  const rows = [];

  for (let i = 0; i < values.length; i++) {
    const participant = clean(values[i][0], 40);

    if (!participant) continue;

    rows.push({
      rowNumber: i + 2,
      participant: participant,
      total: Number(values[i][1]) || 0,
      codes: parseCodeList(values[i][2]),
      lastScan: formatDateCell(values[i][3])
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
 * HELPERS
 ***************/
function parseCodeList(value) {
  return String(value || '')
    .split(/[,;\n]+/)
    .map(code => clean(code, 120))
    .filter(Boolean);
}

function formatCodeList(codes) {
  return codes
    .map(code => clean(code, 120))
    .filter(Boolean)
    .join(', ');
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
    .setMimeType(ContentService.MimeType.JSON)
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
