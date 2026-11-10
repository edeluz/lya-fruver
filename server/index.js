'use strict';

const config = require('./config');
const { createApp } = require('./app');
const { cerrarPool } = require('./api');
const { variablesFaltantes } = require('./db');

const app = createApp();
const server = app.listen(config.port, () => {
  console.log(`L&A Fruver escuchando en el puerto ${config.port}`);
  console.log(`Modo: ${config.isProduction ? 'producción' : 'desarrollo'}. ` +
    `Usuarios de prueba del login: ${config.usuariosPrueba ? 'ACTIVOS' : 'APAGADOS (pon USUARIOS_PRUEBA=si para activarlos)'}.`);
  const faltan = variablesFaltantes();
  console.log(faltan.length
    ? `Base de datos: SIN CONFIGURAR. Faltan las variables: ${faltan.join(', ')}.`
    : `Base de datos: configurada (${process.env.DB_NAME || 'fruver_lya'}).`);
  console.log(String(process.env.API_TOKEN || '').trim().length >= 32
    ? 'Llave de API (Authorization: Bearer): ACTIVA.'
    : 'Llave de API (Authorization: Bearer): APAGADA (define API_TOKEN, mínimo 32 caracteres).');
});

// Apagado ordenado cuando Docker detiene el contenedor.
function shutdown(signal) {
  console.log(`Recibido ${signal}, cerrando...`);
  server.close(() => cerrarPool().finally(() => process.exit(0)));
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
