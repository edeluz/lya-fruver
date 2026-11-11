// Genera versiones optimizadas del logo a partir del original (public/img/logo-fruver-la.png).
// Solo cambia el TAMAÑO: no redibuja, no recorta el diseño ni cambia colores.
// Se ejecuta a mano cuando cambie el logo:  node scripts/logo.js
// Los archivos generados se guardan en git (public/img/), así Docker no necesita "sharp".
'use strict';

const path = require('node:path');
const sharp = require('sharp');

const CARPETA = path.join(__dirname, '..', 'public', 'img');
const ORIGINAL = path.join(CARPETA, 'logo-fruver-la.png');

// [archivo, ancho en píxeles] — el alto se calcula solo, manteniendo la proporción.
// Se generan al doble del tamaño en pantalla para que se vea nítido en celulares (pantallas 2x).
const VERSIONES = [
  ['logo-login.png', 440],    // login: se muestra a ~220 px de ancho
  ['logo-navbar.png', 200],   // barra de navegación: se muestra a ~100 px de ancho
];

// Íconos cuadrados (favicon y acceso directo en celular): el logo centrado sobre fondo transparente.
const ICONOS = [
  ['favicon-32.png', 32],
  ['favicon-180.png', 180],   // apple-touch-icon
];

async function main() {
  const meta = await sharp(ORIGINAL).metadata();
  console.log(`Original: ${meta.width}x${meta.height}, canal alfa: ${meta.hasAlpha ? 'sí' : 'no'}`);

  for (const [archivo, ancho] of VERSIONES) {
    const info = await sharp(ORIGINAL)
      .resize({ width: ancho })
      .png({ compressionLevel: 9, palette: true, quality: 90 })
      .toFile(path.join(CARPETA, archivo));
    console.log(`${archivo}: ${info.width}x${info.height}, ${(info.size / 1024).toFixed(1)} KB`);
  }

  for (const [archivo, lado] of ICONOS) {
    const info = await sharp(ORIGINAL)
      .resize({ width: lado, height: lado, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png({ compressionLevel: 9 })
      .toFile(path.join(CARPETA, archivo));
    console.log(`${archivo}: ${info.width}x${info.height}, ${(info.size / 1024).toFixed(1)} KB`);
  }
}

main().catch((err) => {
  console.error('No se pudo generar el logo:', err.message);
  process.exit(1);
});
