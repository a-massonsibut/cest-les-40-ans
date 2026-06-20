# Configuration du livre d'or Google Sheets

Le site lit déjà les messages depuis cette feuille Google Sheets :

https://docs.google.com/spreadsheets/d/17N5YJxQmmbHv7IKyeqHqmH7AOJoHJe9kS146kJBsZRw/edit?usp=sharing

Onglet utilisé : GID `0`.

Colonnes attendues :

| A | B | C |
|---|---|---|
| Nom de la personne | Date | Message |

## Étape 1 — Autoriser la lecture publique

La lecture fonctionne si la feuille est accessible publiquement en lecture. Dans Google Sheets :

1. Cliquer sur **Partager**
2. Mettre **Toute personne disposant du lien**
3. Choisir **Lecteur**

## Étape 2 — Créer le Web App Apps Script pour écrire dans la feuille

GitHub Pages ne peut pas écrire directement dans Google Sheets depuis le navigateur. Il faut donc un petit Web App Google Apps Script attaché à la feuille.

Dans Google Sheets :

1. Aller dans **Extensions → Apps Script**
2. Coller ce code dans `Code.gs`
3. Déployer en Web App avec :
   - **Exécuter en tant que** : Moi
   - **Qui a accès** : Tout le monde
4. Copier l'URL de déploiement qui se termine par `/exec`

```javascript
const SPREADSHEET_ID = '17N5YJxQmmbHv7IKyeqHqmH7AOJoHJe9kS146kJBsZRw';
const SHEET_GID = 0;

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const sheet = getSheetByGid(SHEET_GID);
    const params = e.parameter || {};
    const name = clean(params.name, 40);
    const date = clean(params.date, 20) || Utilities.formatDate(new Date(), 'Europe/Paris', 'dd/MM/yyyy');
    const message = clean(params.message, 500);

    if (!name || !message) {
      return json({ success: false, error: 'missing_fields' });
    }

    sheet.appendRow([name, date, message]);
    return json({ success: true });
  } catch (error) {
    return json({ success: false, error: String(error) });
  } finally {
    lock.releaseLock();
  }
}

function doGet() {
  return json({ success: true });
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
```

## Étape 3 — Brancher l'URL dans le site

La lecture publique dans `index.html` utilise aussi ce GID `0`, pas le nom de l'onglet.

L'URL du Web App est déjà branchée dans `index.html` :

```javascript
const GUESTBOOK_WRITE_URL = 'https://script.google.com/macros/s/AKfycbxhGA7P7-QTLsM2d1W6V_1uiPvOKD5yI1ws7LRZxgo2EpCMpgg0KJzeg7K4_u6dBjqc/exec';
```

Si tu redéploies un nouveau Web App plus tard, remplace simplement cette valeur par la nouvelle URL `/exec`, puis commit/push et redéploie le site.

## Vérification

1. Ouvrir le site
2. Poster un message dans le livre d'or
3. Vérifier qu'une nouvelle ligne est ajoutée dans Google Sheets
4. Attendre quelques secondes : le message doit apparaître dans la liste

Note : le site attend de relire le message dans Google Sheets avant d'afficher le succès, pour s'assurer que le message est bien stocké.
