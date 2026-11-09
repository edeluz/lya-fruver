'use strict';

const path = require('node:path');
const express = require('express');
const helmet = require('helmet');
const config = require('./config');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const ONE_WEEK_SECONDS = 7 * 24 * 60 * 60;

function buildSecurityHeaders() {
  return helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        scriptSrcAttr: ["'none'"],
        // Los HTML usan atributos style="..." en todo el diseño; por eso se permite CSS en línea.
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        fontSrc: ["'self'"],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        upgradeInsecureRequests: config.isProduction ? [] : null,
      },
    },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  });
}

// Las librerías y fuentes casi nunca cambian: se pueden guardar en caché una semana.
// El resto (HTML, JS propio) se revisa en cada visita para que los cambios se vean de inmediato.
function setCacheHeaders(res, filePath) {
  const relative = path.relative(PUBLIC_DIR, filePath).split(path.sep)[0];
  if (relative === 'vendor' || relative === 'fonts') {
    res.setHeader('Cache-Control', `public, max-age=${ONE_WEEK_SECONDS}`);
  } else {
    res.setHeader('Cache-Control', 'no-cache');
  }
}

function createApp() {
  const app = express();
  app.disable('x-powered-by');
  // Caddy está delante de la app y le pasa la IP real del visitante.
  app.set('trust proxy', 1);

  app.use(buildSecurityHeaders());

  app.get('/healthz', (req, res) => {
    res.json({ status: 'ok' });
  });

  app.use(express.static(PUBLIC_DIR, {
    extensions: ['html'],
    index: 'index.html',
    dotfiles: 'ignore',
    setHeaders: setCacheHeaders,
  }));

  app.use((req, res) => {
    res.status(404).type('text/plain').send('Página no encontrada');
  });

  // Errores: el detalle queda en el registro del servidor, nunca se envía al visitante.
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error(`[error] ${req.method} ${req.path}:`, err);
    const status = Number.isInteger(err.status) && err.status >= 400 && err.status < 500 ? err.status : 500;
    res.status(status).type('text/plain').send(status === 500 ? 'Error interno del servidor' : 'Solicitud no válida');
  });

  return app;
}

module.exports = { createApp };
