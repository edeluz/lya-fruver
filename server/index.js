'use strict';

const config = require('./config');
const { createApp } = require('./app');

const app = createApp();
const server = app.listen(config.port, () => {
  console.log(`L&A Fruver escuchando en el puerto ${config.port}`);
});

// Apagado ordenado cuando Docker detiene el contenedor.
function shutdown(signal) {
  console.log(`Recibido ${signal}, cerrando...`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
