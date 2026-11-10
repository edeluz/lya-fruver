'use strict';

/* ============================================================
   L&A FRUVER - API de datos: aquí solo se juntan las rutas.
   Cada unidad de negocio vive en su propio archivo en server/rutas/:
     proveedores.js, productos.js, clientes.js, pedidos.js, facturas.js
   Piezas compartidas: server/rutas/comun.js. Conexión: server/db.js.
   ============================================================ */

const express = require('express');
const { baseConfigurada, obtenerPool, cerrarPool } = require('./db');
const { ErrorApi, asincrono, requiereBase } = require('./rutas/comun');
const { crearRutasProveedores } = require('./rutas/proveedores');
const { crearRutasProductos } = require('./rutas/productos');
const { crearRutasClientes } = require('./rutas/clientes');
const { crearRutasPedidos } = require('./rutas/pedidos');
const { crearRutasFacturas } = require('./rutas/facturas');

/* ---------- Límite de peticiones por IP (en memoria): 300 por minuto ---------- */
const VENTANA_MS = 60 * 1000;
const MAX_PETICIONES = 300;
const contadores = new Map();   // ip -> { cantidad, desde }

function limitarPeticiones(req, res, next) {
  const ahora = Date.now();
  const c = contadores.get(req.ip);
  if (!c || ahora - c.desde > VENTANA_MS) {
    contadores.set(req.ip, { cantidad: 1, desde: ahora });
    return next();
  }
  c.cantidad += 1;
  if (c.cantidad > MAX_PETICIONES) {
    res.set('Retry-After', String(Math.ceil((c.desde + VENTANA_MS - ahora) / 1000)));
    return res.status(429).json({ error: 'Demasiadas peticiones. Espera un momento.' });
  }
  return next();
}

setInterval(() => {
  const ahora = Date.now();
  for (const [ip, c] of contadores) if (ahora - c.desde > VENTANA_MS) contadores.delete(ip);
}, VENTANA_MS).unref();

/* ---------- Montaje ---------- */
function crearRutasApi() {
  const api = express.Router();
  api.use(limitarPeticiones);
  api.use(express.json({ limit: '100kb' }));
  // Los datos cambian: el navegador no debe guardarlos en caché.
  api.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

  // Estado de la base: 200 si hay conexión, 503 si no. No muestra detalles.
  api.get('/health', asincrono(async (req, res) => {
    if (!baseConfigurada()) return res.status(503).json({ status: 'sin-configurar' });
    try {
      await obtenerPool().query('SELECT 1');
      return res.json({ status: 'ok', baseDeDatos: 'ok' });
    } catch (err) {
      console.error('[health] sin conexión a la base:', err.code || err.message);
      return res.status(503).json({ status: 'error', baseDeDatos: 'sin conexión' });
    }
  }));

  // Unidades de negocio
  api.use('/proveedores', requiereBase, crearRutasProveedores());
  api.use('/productos', requiereBase, crearRutasProductos());
  api.use('/clientes', requiereBase, crearRutasClientes());
  api.use('/pedidos', requiereBase, crearRutasPedidos());
  api.use('/facturas', requiereBase, crearRutasFacturas());

  // Errores de la API: siempre en JSON y sin detalles internos.
  // eslint-disable-next-line no-unused-vars
  api.use((err, req, res, next) => {
    if (err instanceof ErrorApi) {
      return res.status(err.status).json({ error: err.message, ...(err.detalles ? { detalles: err.detalles } : {}) });
    }
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'El cuerpo no es JSON válido' });
    if (err.type === 'entity.too.large') return res.status(413).json({ error: 'El cuerpo es demasiado grande' });
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Ese registro ya existe' });
    console.error(`[api] ${req.method} ${req.path}:`, err.code || '', err.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  });

  return api;
}

module.exports = { crearRutasApi, cerrarPool };
