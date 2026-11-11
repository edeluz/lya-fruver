'use strict';

/* Información de versión que se muestra abajo en la página de login.
   - version, build, fecha_build: vienen de build-info.json (lo crea "npm run build").
   - inicio: hora en que arrancó el servidor (cambia con cada despliegue o reinicio).
   No contiene secretos. */

const fs = require('node:fs');
const path = require('node:path');
const paquete = require('../package.json');

const INICIO = new Date().toISOString();

function leerBuildInfo() {
  try {
    const datos = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'build-info.json'), 'utf8'));
    return {
      version: String(datos.version || paquete.version),
      build: datos.build ? String(datos.build) : null,
      fecha_build: datos.fecha_build ? String(datos.fecha_build) : null,
    };
  } catch {
    // Si no se ejecutó "npm run build" no existe el archivo: se muestra solo la versión.
    return { version: paquete.version, build: null, fecha_build: null };
  }
}

const BUILD = Object.freeze(leerBuildInfo());

function infoVersion() {
  return { ...BUILD, inicio: INICIO };
}

module.exports = { infoVersion };
