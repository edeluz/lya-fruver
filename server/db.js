'use strict';

/* ============================================================
   L&A FRUVER - Conexión a la base de datos (MariaDB)
   Nunca se escriben datos de conexión en el código: salen de .env
   (o de las variables de entorno de Easypanel).
   ============================================================ */

const { esSi } = require('./config');

const DB = {
  host: process.env.DB_HOST || '',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || '',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'fruver_lya',
  // DB_SSL=si cifra la conexión (TLS) y verifica el certificado del servidor.
  ssl: esSi(process.env.DB_SSL),
};

function baseConfigurada() {
  return Boolean(DB.host && DB.user && DB.password);
}

/* Pool: varias conexiones reutilizables.
   mysql2 se carga solo cuando hace falta, para que el resto de la app
   (login, páginas) funcione aunque la base no esté configurada. */
let pool = null;

function obtenerPool() {
  if (pool) return pool;
  const mysql = require('mysql2/promise');
  pool = mysql.createPool({
    host: DB.host,
    port: DB.port,
    user: DB.user,
    password: DB.password,
    database: DB.database,
    ssl: DB.ssl ? { minVersion: 'TLSv1.2', rejectUnauthorized: true } : undefined,
    connectionLimit: 10,
    waitForConnections: true,
    // Las fechas se guardan en UTC (UTC_TIMESTAMP) y se leen como UTC.
    timezone: 'Z',
    // Las columnas DATE (p. ej. facturas.fecha) llegan como texto "AAAA-MM-DD", sin hora,
    // para que el día no se corra por la zona horaria.
    dateStrings: ['DATE'],
    // Precios y cantidades (DECIMAL) llegan como números, no como texto.
    decimalNumbers: true,
    charset: 'utf8mb4_unicode_ci',
    // Prohíbe varias sentencias en una sola consulta (defensa extra contra inyección SQL).
    multipleStatements: false,
  });
  return pool;
}

/* Ejecuta varias operaciones como una sola: si alguna falla, se deshacen todas.
   Se usará en pedidos y facturas (encabezado + productos). */
async function enTransaccion(fn) {
  const conexion = await obtenerPool().getConnection();
  try {
    await conexion.beginTransaction();
    const resultado = await fn(conexion);
    await conexion.commit();
    return resultado;
  } catch (err) {
    await conexion.rollback().catch(() => {});
    throw err;
  } finally {
    conexion.release();
  }
}

async function cerrarPool() {
  if (pool) {
    const p = pool;
    pool = null;
    await p.end();
  }
}

module.exports = { baseConfigurada, obtenerPool, enTransaccion, cerrarPool };
