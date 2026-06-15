# Guide de configuration RSVP

## 📋 Résumé

Ce système permet de :
1. **Collecter les réponses RSVP de manière sécurisée** via Netlify Forms
2. **Afficher les compteurs d'invités** (Oui, Peut-être, Non) sur la page d'accueil
3. **Garder les réponses privées** (uniquement visibles par vous dans Netlify)

---

## 🚀 Configuration rapide

### Étape 1 : Déployer sur Netlify

1. Créez un compte Netlify (gratuit) : https://www.netlify.com/
2. Importez votre dépôt GitHub
3. Déployez le site
4. Attendez que le déploiement soit terminé

### Étape 2 : Tester le formulaire

1. Allez sur `https://votre-site.netlify.app/rsvp.html`
2. Remplissez le formulaire avec un test
3. Soumettez-le
4. **Vérifiez dans Netlify** :
   - Allez dans votre tableau de bord Netlify
   - Cliquez sur votre site
   - Allez dans l'onglet **"Forms"**
   - Vous devriez voir votre soumission dans la liste "rsvp"

✅ **Si vous voyez votre soumission, le formulaire fonctionne !**

---

## 📊 Mettre à jour les compteurs d'invités

Il y a **2 méthodes** pour mettre à jour les compteurs :

### Méthode A : Automatique (Recommandé)

Utilisez **GitHub Actions** pour mettre à jour automatiquement les compteurs quand le PR est mergé.

1. **Créez un fichier** `.github/workflows/update-counters.yml` :

```yaml
name: Update RSVP Counters

on:
  push:
    branches: [ main ]
    paths:
      - 'data/rsvp-counts.json'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm install
      - run: node update-counters.js
      - run: |
          git config --global user.name "GitHub Actions"
          git config --global user.email "actions@github.com"
          git add data/rsvp-counts.json
          git commit -m "Auto-update RSVP counts" || echo "No changes"
          git push
```

2. **Mettez à jour manuellement** `data/rsvp-counts.json` quand vous recevez de nouvelles soumissions
3. **Commitez et poussez** - GitHub Actions s'occupera du reste

### Méthode B : Manuel (Plus simple)

**La méthode la plus simple et la plus fiable** :

1. **Allez dans Netlify** → onglet **Forms**
2. **Comptez les soumissions** :
   - Combien de "oui" ?
   - Combien de "peutEtre" ?
   - Combien de "non" ?
3. **Éditez le fichier** `data/rsvp-counts.json` :

```json
{
  "counts": {
    "oui": 5,
    "peutEtre": 2,
    "non": 1
  },
  "total": 8,
  "lastUpdated": "2026-06-14T15:30:00Z"
}
```

4. **Commitez et poussez** :
```bash
git add data/rsvp-counts.json
git commit -m "Update RSVP counts: 5 oui, 2 peut-être, 1 non"
git push
```

5. **Attendez le déploiement** (1-2 minutes)
6. **Rafraîchissez votre site** - les compteurs seront mis à jour !

### Méthode C : Avec un script (Pour les utilisateurs avancés)

1. Installez Node.js sur votre machine
2. Exécutez le script :
```bash
node update-counters.js oui=5 peutEtre=2 non=1
```
3. Commitez et poussez le fichier mis à jour

---

## 🔍 Vérifier que tout fonctionne

### 1. Le formulaire fonctionne ?
- [ ] Je vois mes soumissions dans Netlify → Forms
- [ ] Les emails de notification arrivent (si configuré)

### 2. Les compteurs s'affichent ?
- [ ] Sur la page d'accueil, je vois les nombres dans les compteurs
- [ ] La date de dernière mise à jour s'affiche

### 3. Les compteurs se mettent à jour ?
- [ ] Après avoir modifié `data/rsvp-counts.json` et poussé, les compteurs changent

---

## ⚠️ Problèmes courants

### Problème : "Le formulaire ne soumet pas"
**Solutions :**
- Vérifiez que le site est déployé sur Netlify (pas en local)
- Vérifiez que le formulaire a bien l'attribut `netlify` :
  ```html
  <form name="rsvp" method="POST" netlify ...>
  ```
- Vérifiez qu'il y a bien un champ caché `form-name` :
  ```html
  <input type="hidden" name="form-name" value="rsvp" />
  ```

### Problème : "Les compteurs ne se mettent pas à jour"
**Solutions :**
- Avez-vous **commité et poussé** le fichier `data/rsvp-counts.json` ?
- Avez-vous **attendu le déploiement** (1-2 minutes) ?
- Avez-vous **rafraîchi la page** (Ctrl+F5) ?
- Vérifiez la console du navigateur (F12 → Console) pour voir s'il y a des erreurs

### Problème : "Je ne vois pas le fichier data/rsvp-counts.json sur GitHub"
**Solution :**
- Le fichier est dans la branche `vibe/secure-rsvp-form-fb9ba3`
- URL directe : https://github.com/a-massonsibut/cest-les-40-ans/blob/vibe/secure-rsvp-form-fb9ba3/data/rsvp-counts.json
- Si vous voulez le voir dans `main`, il faut merger le PR

---

## 📚 Fichiers importants

| Fichier | Description |
|--------|-------------|
| `rsvp.html` | Page du formulaire RSVP |
| `index.html` | Page d'accueil avec les compteurs |
| `data/rsvp-counts.json` | Données des compteurs (à mettre à jour) |
| `update-counters.js` | Script pour mettre à jour les compteurs |
| `netlify.toml` | Configuration Netlify |

---

## 🎯 Résumé des étapes pour faire fonctionner les compteurs

1. **Déployer sur Netlify** ✅
2. **Tester le formulaire** (vous devriez voir les soumissions dans Netlify Forms) ✅
3. **Compter les soumissions** dans Netlify Forms
4. **Mettre à jour** `data/rsvp-counts.json` avec les bons nombres
5. **Commiter et pousser** les changements
6. **Attendre le déploiement** (1-2 min)
7. **Rafraîchir la page d'accueil** → Les compteurs devraient être mis à jour ! 🎉

---

## 💡 Conseil

**Commencez par la Méthode B (manuelle)** - c'est la plus simple et la plus fiable.
Une fois que vous êtes à l'aise, vous pourrez passer à l'automatisation avec GitHub Actions.

---

## 🆘 Besoin d'aide ?

Si quelque chose ne fonctionne pas :
1. Décrivez exactement ce que vous avez fait
2. Décrivez ce qui ne fonctionne pas
3. Partagez les messages d'erreur (s'il y en a)

Je suis là pour vous aider ! 😊
