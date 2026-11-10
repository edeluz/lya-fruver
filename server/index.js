'use strict';

const config = require('./config');
const { createApp } = require('./app');
const { cerrarPool } = require('./api');

const app = createApp();
const server = app.listen(config.port, () => {
  console.log(`L&A Fruver escuchando en el puerto ${config.port}`);
  console.log(`Modo: ${config.isProduction ? 'producción' : 'desarrollo'}. ` +
    `Usuarios de prueba del login: ${config.usuariosPrueba ? 'ACTIVOS' : 'APAGADOS (pon USUARIOS_PRUEBA=si para activarlos)'}.`);
});

// Apagado ordenado cuando Docker detiene el contenedor.
function shutdown(signal) {
  console.log(`Recibido ${signal}, cerrando...`);
  server.close(() => cerrarPool().finally(() => process.exit(0)));
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
