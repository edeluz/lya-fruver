'use strict';

/* ============================================================
   L&A FRUVER - Facturas (encabezado + productos facturados)
   Tablas: facturas (id, numero consecutivo, cliente_id, cliente_nombre, cliente_telefono,
                     cliente_direccion, pedido_id, fecha, flete, total, creado_en)
           factura_items (id, factura_id, producto_nombre, cantidad, unidad, precio_unitario, subtotal)
   GET    /api/facturas          lista paginada, de la más nueva a la más vieja
                                 (?pagina, ?limite, ?desde=AAAA-MM-DD, ?hasta=AAAA-MM-DD,
                                  ?cliente_id, ?pedido_id, ?q=nombre del cliente, ?numero)
                                 Cada factura trae sus "items".
   GET    /api/facturas/:id      una, con sus items
   POST   /api/facturas          crear factura + items (transacción)                   (rol admin)
   PUT    /api/facturas/:id      reemplazar encabezado e items (transacción)           (rol admin)
   PATCH  /api/facturas/:id      cambiar datos del encabezado (fecha, flete, cliente)  (rol admin)
   DELETE /api/facturas/:id      NO permitido (405): las facturas no se borran.

   El servidor calcula los montos (no se confía en lo que mande el navegador):
     subtotal de cada item = cantidad x precio_unitario (redondeado a 2 decimales)
     total = suma de subtotales + flete
   "fecha" es opcional: si no se envía, se usa la fecha de hoy en Colombia.
   ============================================================ */

const crypto = require('node:crypto');
const express = require('express');
const { z } = require('zod');
const { obtenerPool, enTransaccion } = require('../db');
const {
  ErrorApi, asincrono, validar, esquemaId, esquemaPaginacion, sqlPaginacion,
  textoOpcional, textoLike, requiereSesion, marcadores, sqlSet, redondear2, esquemaFecha, hoyColombia,
} = require('./comun');

const dinero = z.number().min(0).max(999999999999);

const esquemaItem = z.object({
  producto_nombre: z.string({ error: 'Cada producto necesita "producto_nombre"' }).trim().min(1).max(150),
  cantidad: z.number({ error: 'La cantidad debe ser un número' }).positive('La cantidad debe ser mayor que 0').max(9999999),
  unidad: z.string().trim().min(1).max(20).default('unidad'),
  precio_unitario: dinero.default(0),
}).strict();

const camposEncabezado = {
  cliente_id: esquemaId.nullable().optional(),
  cliente_nombre: z.string().trim().min(1).max(150).optional(),
  cliente_telefono: textoOpcional(30),
  cliente_direccion: textoOpcional(255),
  pedido_id: esquemaId.nullable().optional(),
  fecha: esquemaFecha.optional(),
  flete: dinero.optional(),
};

const esquemaFactura = z.object({
  ...camposEncabezado,
  items: z.array(esquemaItem).min(1, 'La factura debe tener al menos un producto').max(300),
}).strict().refine((f) => f.cliente_id || f.cliente_nombre, {
  message: 'Envía "cliente_id" o "cliente_nombre"',
});

const esquemaFacturaParcial = z.object(camposEncabezado).strict();

const esquemaFiltros = esquemaPaginacion.extend({
  desde: esquemaFecha.optional(),
  hasta: esquemaFecha.optional(),
  cliente_id: esquemaId.optional(),
  pedido_id: esquemaId.optional(),
  q: z.string().trim().max(150).optional(),
  numero: z.coerce.number().int().min(1).optional(),
});

const COLUMNAS = `id, numero, cliente_id, cliente_nombre, cliente_telefono, cliente_direccion,
  pedido_id, fecha, flete, total, creado_en`;

async function agregarItems(db, facturas) {
  if (!facturas.length) return [];
  const ids = facturas.map((f) => f.id);
  const [items] = await db.execute(
    `SELECT id, factura_id, producto_nombre, cantidad, unidad, precio_unitario, subtotal
     FROM factura_items WHERE factura_id IN (${marcadores(ids)}) ORDER BY producto_nombre`, ids);
  const porFactura = new Map();
  for (const it of items) {
    if (!porFactura.has(it.factura_id)) porFactura.set(it.factura_id, []);
    porFactura.get(it.factura_id).push(it);
  }
  return facturas.map((f) => ({ ...f, numero: Number(f.numero), items: porFactura.get(f.id) || [] }));
}

async function buscarFactura(id, db = obtenerPool()) {
  const [filas] = await db.execute(`SELECT ${COLUMNAS} FROM facturas WHERE id = ?`, [id]);
  if (!filas.length) throw new ErrorApi(404, 'Factura no encontrada');
  return (await agregarItems(db, filas))[0];
}

/* Datos del cliente para la factura (se copian, para que la factura no cambie si luego se
   edita el cliente). Con cliente_id, lo que no envíes se toma del cliente. */
async function resolverCliente(con, d) {
  if (!d.cliente_id) {
    return {
      cliente_id: null,
      cliente_nombre: d.cliente_nombre,
      cliente_telefono: d.cliente_telefono ?? null,
      cliente_direccion: d.cliente_direccion ?? null,
    };
  }
  const [filas] = await con.execute('SELECT id, nombre, telefono, direccion FROM clientes WHERE id = ?', [d.cliente_id]);
  if (!filas.length) throw new ErrorApi(400, 'El cliente no existe');
  const c = filas[0];
  return {
    cliente_id: c.id,
    cliente_nombre: d.cliente_nombre || c.nombre,
    cliente_telefono: d.cliente_telefono !== undefined ? d.cliente_telefono : c.telefono,
    cliente_direccion: d.cliente_direccion !== undefined ? d.cliente_direccion : c.direccion,
  };
}

async function revisarPedido(con, pedidoId) {
  if (!pedidoId) return;
  const [filas] = await con.execute('SELECT id FROM pedidos WHERE id = ?', [pedidoId]);
  if (!filas.length) throw new ErrorApi(400, 'El pedido no existe');
}

function calcularItems(items) {
  return items.map((it) => ({ ...it, subtotal: redondear2(it.cantidad * it.precio_unitario) }));
}

function calcularTotal(items, flete) {
  return redondear2(items.reduce((suma, it) => suma + it.subtotal, 0) + flete);
}

async function insertarItems(con, facturaId, items) {
  for (const it of items) {
    await con.execute(
      `INSERT INTO factura_items (id, factura_id, producto_nombre, cantidad, unidad, precio_unitario, subtotal)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [crypto.randomUUID(), facturaId, it.producto_nombre, it.cantidad, it.unidad, it.precio_unitario, it.subtotal]);
  }
}

function crearRutasFacturas() {
  const r = express.Router();

  r.get('/', requiereSesion(), asincrono(async (req, res) => {
    const f = validar(esquemaFiltros, req.query);
    const condiciones = [];
    const valores = [];
    if (f.desde) { condiciones.push('fecha >= ?'); valores.push(f.desde); }
    if (f.hasta) { condiciones.push('fecha <= ?'); valores.push(f.hasta); }
    if (f.cliente_id) { condiciones.push('cliente_id = ?'); valores.push(f.cliente_id); }
    if (f.pedido_id) { condiciones.push('pedido_id = ?'); valores.push(f.pedido_id); }
    if (f.q) { condiciones.push('cliente_nombre LIKE ?'); valores.push(textoLike(f.q)); }
    if (f.numero) { condiciones.push('numero = ?'); valores.push(f.numero); }
    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';

    const db = obtenerPool();
    const [[{ total }]] = await db.execute(`SELECT COUNT(*) AS total FROM facturas ${where}`, valores);
    const [filas] = await db.execute(
      `SELECT ${COLUMNAS} FROM facturas ${where} ORDER BY numero DESC ${sqlPaginacion(f)}`, valores);

    res.json({ datos: await agregarItems(db, filas), total: Number(total), pagina: f.pagina, limite: f.limite });
  }));

  r.get('/:id', requiereSesion(), asincrono(async (req, res) => {
    res.json(await buscarFactura(validar(esquemaId, req.params.id)));
  }));

  // Crear: encabezado + items en una transacción. El número consecutivo lo pone la base.
  r.post('/', requiereSesion('admin'), asincrono(async (req, res) => {
    const d = validar(esquemaFactura, req.body);
    const id = crypto.randomUUID();
    const factura = await enTransaccion(async (con) => {
      const cliente = await resolverCliente(con, d);
      await revisarPedido(con, d.pedido_id);
      const items = calcularItems(d.items);
      const flete = d.flete ?? 0;
      await con.execute(
        `INSERT INTO facturas (id, cliente_id, cliente_nombre, cliente_telefono, cliente_direccion,
                               pedido_id, fecha, flete, total)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, cliente.cliente_id, cliente.cliente_nombre, cliente.cliente_telefono, cliente.cliente_direccion,
          d.pedido_id ?? null, d.fecha ?? hoyColombia(), flete, calcularTotal(items, flete)]);
      await insertarItems(con, id, items);
      return buscarFactura(id, con);
    });
    res.status(201).location(`/api/facturas/${id}`).json(factura);
  }));

  // Reemplazar todo: encabezado e items (los anteriores se borran). Conserva número y creado_en.
  r.put('/:id', requiereSesion('admin'), asincrono(async (req, res) => {
    const id = validar(esquemaId, req.params.id);
    const d = validar(esquemaFactura, req.body);
    const factura = await enTransaccion(async (con) => {
      const actual = await buscarFactura(id, con);
      const cliente = await resolverCliente(con, d);
      await revisarPedido(con, d.pedido_id);
      const items = calcularItems(d.items);
      const flete = d.flete ?? 0;
      await con.execute(
        `UPDATE facturas SET cliente_id = ?, cliente_nombre = ?, cliente_telefono = ?, cliente_direccion = ?,
                pedido_id = ?, fecha = ?, flete = ?, total = ?
         WHERE id = ?`,
        [cliente.cliente_id, cliente.cliente_nombre, cliente.cliente_telefono, cliente.cliente_direccion,
          d.pedido_id ?? null, d.fecha ?? actual.fecha, flete, calcularTotal(items, flete), id]);
      await con.execute('DELETE FROM factura_items WHERE factura_id = ?', [id]);
      await insertarItems(con, id, items);
      return buscarFactura(id, con);
    });
    res.json(factura);
  }));

  // Cambiar datos del encabezado. Si cambia el flete, se recalcula el total.
  r.patch('/:id', requiereSesion('admin'), asincrono(async (req, res) => {
    const id = validar(esquemaId, req.params.id);
    const d = validar(esquemaFacturaParcial, req.body);
    const factura = await enTransaccion(async (con) => {
      const actual = await buscarFactura(id, con);
      const campos = { fecha: d.fecha, flete: d.flete, pedido_id: d.pedido_id };
      if (d.pedido_id) await revisarPedido(con, d.pedido_id);

      if (d.cliente_id) {
        Object.assign(campos, await resolverCliente(con, d));
      } else {
        if (d.cliente_id === null) campos.cliente_id = null;
        campos.cliente_nombre = d.cliente_nombre;
        campos.cliente_telefono = d.cliente_telefono;
        campos.cliente_direccion = d.cliente_direccion;
      }
      if (d.flete !== undefined) campos.total = calcularTotal(actual.items, d.flete);

      const set = sqlSet(campos);
      if (set.vacio) throw new ErrorApi(400, 'No enviaste ningún campo para cambiar');
      await con.execute(`UPDATE facturas SET ${set.sql} WHERE id = ?`, [...set.valores, id]);
      return buscarFactura(id, con);
    });
    res.json(factura);
  }));

  // Las facturas son documentos contables: no se borran.
  r.delete('/:id', requiereSesion('admin'), (req, res) => {
    res.set('Allow', 'GET, PUT, PATCH').status(405).json({ error: 'Las facturas no se pueden borrar' });
  });

  return r;
}

module.exports = { crearRutasFacturas };
