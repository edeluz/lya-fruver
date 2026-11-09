// Copia las librerías del navegador y las fuentes desde node_modules a public/,
// para que todo se sirva desde nuestro propio servidor (sin CDNs externos).
// Se ejecuta con: npm run build
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const MODULES = path.join(ROOT, 'node_modules');
const PUBLIC = path.join(ROOT, 'public');

const VENDOR_FILES = [
  ['chart.js/dist/chart.umd.min.js', 'vendor/chart.umd.min.js'],
  ['html2canvas/dist/html2canvas.min.js', 'vendor/html2canvas.min.js'],
  ['xlsx/dist/xlsx.full.min.js', 'vendor/xlsx.full.min.js'],
];

const FONT_WEIGHTS = {
  poppins: [600, 700, 800],
  inter: [400, 500, 600, 700],
};

for (const [family, weights] of Object.entries(FONT_WEIGHTS)) {
  for (const weight of weights) {
    const file = `${family}-latin-${weight}-normal.woff2`;
    VENDOR_FILES.push([`@fontsource/${family}/files/${file}`, `fonts/${file}`]);
  }
}

for (const [from, to] of VENDOR_FILES) {
  const source = path.join(MODULES, from);
  const target = path.join(PUBLIC, to);
  if (!fs.existsSync(source)) {
    console.error(`Falta el archivo ${from}. Ejecuta "npm ci" primero.`);
    process.exit(1);
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}

console.log(`Copiados ${VENDOR_FILES.length} archivos a public/vendor y public/fonts.`);
