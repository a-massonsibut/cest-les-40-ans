# Configuration de la web app QR code

Cette web app permet aux invités de scanner des QR codes avec leur téléphone, sans passer par l'App Store ou le Play Store.

Page du jeu : `qr-game.html`

## Google Spreadsheet utilisé

Le jeu est prévu pour utiliser ce Google Spreadsheet existant :

https://docs.google.com/spreadsheets/d/17N5YJxQmmbHv7IKyeqHqmH7AOJoHJe9kS146kJBsZRw/edit

Onglets utilisés :

| Usage | Lien | GID |
|---|---|---:|
| Liste des QR codes et des points | https://docs.google.com/spreadsheets/d/17N5YJxQmmbHv7IKyeqHqmH7AOJoHJe9kS146kJBsZRw/edit?gid=1788030929#gid=1788030929 | `1788030929` |
| Résultats des participants | https://docs.google.com/spreadsheets/d/17N5YJxQmmbHv7IKyeqHqmH7AOJoHJe9kS146kJBsZRw/edit?gid=2083660634#gid=2083660634 | `2083660634` |

## Colonnes attendues

### Onglet liste des QR codes — GID `1788030929`

Les 2 premières colonnes déjà présentes suffisent :

| A | B | C optionnelle | D optionnelle |
|---|---:|---|---|
| QR_code | Points | Description | Active |
| QR_CHARTREUSE_7F3A | 10 | Entrée du gîte | TRUE |
| QR_BONUS_90S | 50 | Bonus années 90 | TRUE |

- Le QR code imprimé doit contenir la valeur exacte de la colonne `QR_code`.
- La colonne `Description` est optionnelle, mais pratique pour reconnaître les QR codes dans l'app.
- La colonne `Active` est optionnelle : vide ou `TRUE` = actif, `FALSE` = désactivé.

### Onglet résultats — GID `2083660634`

Les 2 premières colonnes déjà présentes sont utilisées comme classement :

| A | B | C ajoutée automatiquement | D ajoutée automatiquement |
|---|---:|---|---|
| Nom | Résultat | QR_codes_scannés | Dernier_scan |

La web app met à jour une ligne par participant :

- `Nom` : prénom ou nom d'équipe.
- `Résultat` : score total.
- `QR_codes_scannés` : liste des codes déjà validés pour éviter les doublons.
- `Dernier_scan` : date du dernier scan.

## Créer le Web App Google Apps Script

GitHub Pages / Netlify ne peut pas écrire directement dans Google Sheets depuis le navigateur. Il faut donc un Web App Google Apps Script.

1. Ouvrir le Spreadsheet.
2. Aller dans **Extensions → Apps Script**.
3. Coller le code ci-dessous dans `Code.gs`.
4. Cliquer sur **Déployer → Nouveau déploiement → Application Web**.
5. Paramètres :
   - **Exécuter en tant que** : Moi
   - **Qui a accès** : Tout le monde
6. Copier l'URL de déploiement qui finit par `/exec`.
7. Dans `qr-game.html`, remplacer :

```javascript
const QR_GAME_API_URL = '';
```

par :

```javascript
const QR_GAME_API_URL = 'https://script.google.com/macros/s/TON_DEPLOIEMENT/exec';
```

## Code Apps Script

```javascript
const SPREADSHEET_ID = '17N5YJxQmmbHv7IKyeqHqmH7AOJoHJe9kS146kJBsZRw';
const QR_SHEET_GID = 1788030929;
const RESULTS_SHEET_GID = 2083660634;
const TIMEZONE = 'Europe/Paris';
const RESULT_HEADERS = ['Nom', 'Résultat', 'QR_codes_scannés', 'Dernier_scan'];

function doGet(e) {
  const params = e.parameter || {};
  const action = clean(params.action, 30);

  try {
    if (action === 'lookup') {
      const qr = findQrCode(clean(params.code, 120));
      return jsonp(params, {
        success: true,
        valid: Boolean(qr),
        points: qr ? qr.points : 0,
        description: qr ? qr.description : ''
      });
    }

    if (action === 'status') {
      const participant = clean(params.participant, 40);
      return jsonp(params, getStatusPayload(participant));
    }

    return jsonp(params, getStatusPayload(''));
  } catch (error) {
    return jsonp(params, { success: false, error: String(error) });
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const params = e.parameter || {};
    const action = clean(params.action, 30);
    const participant = clean(params.participant, 40);
    const code = clean(params.code, 120);

    if (action !== 'scan' || !participant || !code) {
      return json({ success: false, error: 'missing_fields' });
    }

    const qr = findQrCode(code);
    if (!qr) {
      return json({ success: false, error: 'unknown_qr_code' });
    }

    const resultsSheet = getSheetByGid(RESULTS_SHEET_GID);
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
      resultsSheet.getRange(existing.rowNumber, 2, 1, 3).setValues([[total, formatCodeList(codes), date]]);

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

function getStatusPayload(participant) {
  const resultsSheet = getSheetByGid(RESULTS_SHEET_GID);
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
    scans: participantRow ? participantRow.codes.map(code => scanFromCode(code, participantRow.lastScan, qrMap)) : [],
    leaderboard: getLeaderboard(resultRows)
  };
}

function scanFromCode(code, date, qrMap) {
  const qr = qrMap[normalKey(code)] || { code: code, points: 0, description: '' };
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
  const sheet = getSheetByGid(QR_SHEET_GID);
  const values = sheet.getDataRange().getValues();
  const map = {};

  for (let i = 1; i < values.length; i++) {
    const rowCode = clean(values[i][0], 120);
    if (!rowCode) continue;

    const activeValue = values[i][3];
    const active = activeValue === undefined || activeValue === null || activeValue === true || String(activeValue).trim() === '' || String(activeValue).toUpperCase() === 'TRUE';
    if (!active) continue;

    map[normalKey(rowCode)] = {
      code: rowCode,
      points: Number(values[i][1]) || 0,
      description: clean(values[i][2], 200)
    };
  }

  return map;
}

function getResultRows(sheet) {
  if (sheet.getLastRow() < 2) return [];

  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, Math.max(4, sheet.getLastColumn())).getValues();
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
    return;
  }

  const headerRange = sheet.getRange(1, 1, 1, RESULT_HEADERS.length);
  const headers = headerRange.getValues()[0];
  let changed = false;

  for (let i = 0; i < RESULT_HEADERS.length; i++) {
    if (!headers[i]) {
      headers[i] = RESULT_HEADERS[i];
      changed = true;
    }
  }

  if (changed) {
    headerRange.setValues([headers]);
  }
}

function getSheetByGid(gid) {
  const sheets = SpreadsheetApp.openById(SPREADSHEET_ID).getSheets();

  for (let i = 0; i < sheets.length; i++) {
    if (sheets[i].getSheetId() === gid) {
      return sheets[i];
    }
  }

  throw new Error('Missing sheet gid: ' + gid);
}

function parseCodeList(value) {
  return String(value || '')
    .split(/[,;\n]+/)
    .map(code => clean(code, 120))
    .filter(Boolean);
}

function formatCodeList(codes) {
  return codes.map(code => clean(code, 120)).filter(Boolean).join(', ');
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
```

## Créer les QR codes

Chaque QR code doit contenir uniquement la valeur de la colonne `QR_code`, par exemple :

```text
QR_CHARTREUSE_7F3A
```

Évite de mettre le nombre de points directement dans le QR code, sinon les joueurs peuvent deviner les scores.

## Vérification

1. Déployer le site en HTTPS.
2. Ouvrir `qr-game.html` sur un téléphone.
3. Entrer un prénom ou une équipe.
4. Autoriser la caméra.
5. Scanner un QR code listé dans l'onglet GID `1788030929`.
6. Vérifier que le score du participant est mis à jour dans l'onglet résultats GID `2083660634`.

## Modifier les points pendant le jeu

Tu peux modifier les points dans l'onglet QR codes. Les nouveaux scans utiliseront les nouvelles valeurs. Les scores déjà enregistrés dans l'onglet résultats gardent les points attribués au moment du scan.
