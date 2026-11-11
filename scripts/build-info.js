// Crea build-info.json con el número de build y la fecha en que se construyó la app.
// Se ejecuta con "npm run build" (también dentro de Docker al construir la imagen).
// No contiene secretos: lo muestra la página de login.
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const paquete = require(path.join(ROOT, 'package.json'));

// Número de build = fecha y hora de Colombia (UTC-5): AAAAMMDD-HHMM
const ahora = new Date();
const colombia = new Date(ahora.getTime() - 5 * 60 * 60 * 1000).toISOString();
const numeroBuild = `${colombia.slice(0, 10).replaceAll('-', '')}-${colombia.slice(11, 16).replace(':', '')}`;

const info = {
  version: paquete.version,
  build: numeroBuild,
  fecha_build: ahora.toISOString(),
};

fs.writeFileSync(path.join(ROOT, 'build-info.json'), `${JSON.stringify(info, null, 2)}\n`);
console.log(`build-info.json: versión ${info.version}, build ${info.build}`);
