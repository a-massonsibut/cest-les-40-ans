/**
 * Script pour mettre à jour les compteurs RSVP manuellement
 * 
 * Utilisation:
 * 1. Récupérez les soumissions depuis Netlify Forms
 * 2. Comptez les réponses "oui", "peutEtre", "non"
 * 3. Exécutez: node update-counters.js oui=5 peutEtre=2 non=1
 * 4. Commitez et poussez data/rsvp-counts.json
 */

const fs = require('fs');
const path = require('path');

// Parse command line arguments
const args = process.argv.slice(2);
const counts = { oui: 11, peutEtre: 2, non: 0 };

args.forEach(arg => {
  const [key, value] = arg.split('=');
  if (key in counts) {
    counts[key] = parseInt(value) || 0;
  }
});

// Calculate total
const total = counts.oui + counts.peutEtre + counts.non;

// Create data
const data = {
  counts: counts,
  total: total,
  lastUpdated: new Date().toISOString()
};

// Write to file
const filePath = path.join(__dirname, 'data', 'rsvp-counts.json');
fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');

console.log('✅ Fichier mis à jour:');
console.log(JSON.stringify(data, null, 2));
console.log(`\nFichier: ${filePath}`);
console.log('\nProchaine étape: git add data/rsvp-counts.json && git commit -m "Update RSVP counts" && git push');
