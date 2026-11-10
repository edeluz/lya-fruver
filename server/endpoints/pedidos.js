'use strict';

/* ============================================================
   L&A FRUVER - Pedidos (encabezado + productos del pedido)
   Tablas: pedidos (id, cliente_id, cliente_nombre, comentario, origen, creado_en)
           pedido_items (id, pedido_id, producto_id, producto_nombre, cantidad, unidad, observacion)
   GET    /api/pedidos          lista paginada, del más nuevo al más viejo
                                (?pagina, ?limite, ?desde=AAAA-MM-DD, ?hasta=AAAA-MM-DD (días de Colombia),
                                 ?cliente_id, ?origen=cliente|admin, ?q=nombre del cliente)
                                Cada pedido trae sus "items" y el teléfono/dirección del cliente.
   GET    /api/pedidos/:id      uno, con sus items
   POST   /api/pedidos          crear pedido + items, todo junto (transacción)     (con sesión)
   PUT    /api/pedidos/:id      reemplazar cliente, comentario e items (transacción) (rol admin)
   PATCH  /api/pedidos/:id      cambiar solo cliente y/o comentario                (rol admin)
   DELETE /api/pedidos/:id      BORRA el pedido y sus items (como el panel actual)  (rol admin)
                                No deja borrar un pedido que ya tiene factura (409).

   Cliente del pedido: envía "cliente_id" (cliente existente) o "cliente_nombre".
   Si solo envías el nombre y ese cliente no existe, se crea (como hace el formulario de clientes).

   Cada item: "producto_id" (del catálogo) o "producto_nombre" (producto escrito a mano),
   "cantidad" (> 0), "unidad" (opcional si viene del catálogo) y "observacion" (opcional).
   ============================================================ */

const crypto = require('node:crypto');
const express = require('express');
const { z } = require('zod');
const { obtenerPool, enTransaccion } = require('../db');
const {
  ErrorApi, asincrono, validar, esquemaId, esquemaPaginacion, sqlPaginacion,
  textoOpcional, textoLike, requiereSesion, marcadores, esquemaFecha, inicioDiaColombiaUtc,
} = require('./comun');

const esquemaItem = z.object({
  producto_id: esquemaId.nullable().optional(),
  producto_nombre: z.string().trim().min(1).max(150).optional(),
  cantidad: z.number({ error: 'La cantidad debe ser un número' }).positive('La cantidad debe ser mayor que 0').max(9999999),
  unidad: z.string().trim().min(1).max(20).optional(),
  observacion: textoOpcional(1000),
}).strict().refine((it) => it.producto_id || it.producto_nombre, {
  message: 'Cada producto necesita "producto_id" o "producto_nombre"',
});

const esquemaPedido = z.object({
  cliente_id: esquemaId.nullable().optional(),
  cliente_nombre: z.string().trim().min(1).max(150).optional(),
  comentario: textoOpcional(2000),
  origen: z.enum(['cliente', 'admin']).optional(),
  items: z.array(esquemaItem).min(1, 'El pedido debe tener al menos un producto').max(300),
}).strict().refine((p) => p.cliente_id || p.cliente_nombre, {
  message: 'Envía "cliente_id" o "cliente_nombre"',
});

// PATCH: solo datos del encabezado (para cambiar productos usa PUT).
const esquemaPedidoParcial = z.object({
  cliente_id: esquemaId.nullable().optional(),
  cliente_nombre: z.string().trim().min(1).max(150).optional(),
  comentario: textoOpcional(2000),
}).strict();

const esquemaFiltros = esquemaPaginacion.extend({
  desde: esquemaFecha.optional(),
  hasta: esquemaFecha.optional(),
  cliente_id: esquemaId.optional(),
  origen: z.enum(['cliente', 'admin']).optional(),
  q: z.string().trim().max(150).optional(),
});

const COLUMNAS = `p.id, p.cliente_id, p.cliente_nombre, p.comentario, p.origen, p.creado_en,
  c.telefono AS cliente_telefono, c.direccion AS cliente_direccion`;
const DESDE = 'FROM pedidos p LEFT JOIN clientes c ON c.id = p.cliente_id';

// Agrega a cada pedido sus items (una sola consulta para todos).
async function agregarItems(db, pedidos) {
  if (!pedidos.length) return [];
  const ids = pedidos.map((p) => p.id);
  const [items] = await db.execute(
    `SELECT id, pedido_id, producto_id, producto_nombre, cantidad, unidad, observacion, creado_en
     FROM pedido_items WHERE pedido_id IN (${marcadores(ids)}) ORDER BY creado_en, producto_nombre`, ids);
  const porPedido = new Map();
  for (const it of items) {
    if (!porPedido.has(it.pedido_id)) porPedido.set(it.pedido_id, []);
    porPedido.get(it.pedido_id).push(it);
  }
  return pedidos.map((p) => ({ ...p, items: porPedido.get(p.id) || [] }));
}

async function buscarPedido(id, db = obtenerPool()) {
  const [filas] = await db.execute(`SELECT ${COLUMNAS} ${DESDE} WHERE p.id = ?`, [id]);
  if (!filas.length) throw new ErrorApi(404, 'Pedido no encontrado');
  return (await agregarItems(db, filas))[0];
}

/* Devuelve { cliente_id, cliente_nombre }.
   - Con cliente_id: el cliente debe existir; si no envías nombre, se toma el del cliente.
   - Solo con nombre: busca el cliente por nombre y, si no existe, lo crea. */
async function resolverCliente(con, { cliente_id: clienteId, cliente_nombre: nombre }) {
  if (clienteId) {
    const [filas] = await con.execute('SELECT id, nombre FROM clientes WHERE id = ?', [clienteId]);
    if (!filas.length) throw new ErrorApi(400, 'El cliente no existe');
    return { cliente_id: filas[0].id, cliente_nombre: nombre || filas[0].nombre };
  }
  const [filas] = await con.execute('SELECT id, nombre FROM clientes WHERE nombre = ? LIMIT 1', [nombre]);
  if (filas.length) return { cliente_id: filas[0].id, cliente_nombre: filas[0].nombre };
  const nuevoId = crypto.randomUUID();
  await con.execute('INSERT INTO clientes (id, nombre) VALUES (?, ?)', [nuevoId, nombre]);
  return { cliente_id: nuevoId, cliente_nombre: nombre };
}

// Completa nombre y unidad de los items que vienen del catálogo, y revisa que esos productos existan.
async function prepararItems(con, items) {
  const ids = [...new Set(items.filter((it) => it.producto_id).map((it) => it.producto_id.toLowerCase()))];
  const catalogo = new Map();
  if (ids.length) {
    const [filas] = await con.execute(
      `SELECT id, nombre, unidad FROM productos WHERE id IN (${marcadores(ids)})`, ids);
    for (const f of filas) catalogo.set(f.id, f);
    if (catalogo.size !== ids.length) throw new ErrorApi(400, 'Algún producto del pedido no existe en el catálogo');
  }
  return items.map((it) => {
    const p = it.producto_id ? catalogo.get(it.producto_id.toLowerCase()) : null;
    return {
      producto_id: p ? p.id : null,
      producto_nombre: it.producto_nombre || p.nombre,
      cantidad: it.cantidad,
      unidad: it.unidad || (p ? p.unidad : 'unidad'),
      observacion: it.observacion ?? null,
    };
  });
}

async function insertarItems(con, pedidoId, items) {
  for (const it of items) {
    await con.execute(
      `INSERT INTO pedido_items (id, pedido_id, producto_id, producto_nombre, cantidad, unidad, observacion)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [crypto.randomUUID(), pedidoId, it.producto_id, it.producto_nombre, it.cantidad, it.unidad, it.observacion]);
  }
}

function crearRutasPedidos() {
  const r = express.Router();

  r.get('/', requiereSesion(), asincrono(async (req, res) => {
    const f = validar(esquemaFiltros, req.query);
    const condiciones = [];
    const valores = [];
    if (f.desde) { condiciones.push('p.creado_en >= ?'); valores.push(inicioDiaColombiaUtc(f.desde)); }
    if (f.hasta) { condiciones.push('p.creado_en < ?'); valores.push(inicioDiaColombiaUtc(f.hasta, 1)); }
    if (f.cliente_id) { condiciones.push('p.cliente_id = ?'); valores.push(f.cliente_id); }
    if (f.origen) { condiciones.push('p.origen = ?'); valores.push(f.origen); }
    if (f.q) { condiciones.push('p.cliente_nombre LIKE ?'); valores.push(textoLike(f.q)); }
    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';

    const db = obtenerPool();
    const [[{ total }]] = await db.execute(`SELECT COUNT(*) AS total FROM pedidos p ${where}`, valores);
    const [filas] = await db.execute(
      `SELECT ${COLUMNAS} ${DESDE} ${where} ORDER BY p.creado_en DESC ${sqlPaginacion(f)}`, valores);

    res.json({ datos: await agregarItems(db, filas), total: Number(total), pagina: f.pagina, limite: f.limite });
  }));

  r.get('/:id', requiereSesion(), asincrono(async (req, res) => {
    res.json(await buscarPedido(validar(esquemaId, req.params.id)));
  }));

  // Crear: encabezado + items en una transacción (si algo falla, no queda nada a medias).
  r.post('/', requiereSesion(), asincrono(async (req, res) => {
    const d = validar(esquemaPedido, req.body);
    const id = crypto.randomUUID();
    const pedido = await enTransaccion(async (con) => {
      const cliente = await resolverCliente(con, d);
      const items = await prepararItems(con, d.items);
      await con.execute(
        'INSERT INTO pedidos (id, cliente_id, cliente_nombre, comentario, origen) VALUES (?, ?, ?, ?, ?)',
        [id, cliente.cliente_id, cliente.cliente_nombre, d.comentario ?? null, d.origen ?? 'admin']);
      await insertarItems(con, id, items);
      return buscarPedido(id, con);
    });
    res.status(201).location(`/api/pedidos/${id}`).json(pedido);
  }));

  // Reemplazar: cliente, comentario y TODOS los items (los anteriores se borran). Transacción.
  r.put('/:id', requiereSesion('admin'), asincrono(async (req, res) => {
    const id = validar(esquemaId, req.params.id);
    const d = validar(esquemaPedido, req.body);
    const pedido = await enTransaccion(async (con) => {
      await buscarPedido(id, con);
      const cliente = await resolverCliente(con, d);
      const items = await prepararItems(con, d.items);
      await con.execute(
        'UPDATE pedidos SET cliente_id = ?, cliente_nombre = ?, comentario = ? WHERE id = ?',
        [cliente.cliente_id, cliente.cliente_nombre, d.comentario ?? null, id]);
      await con.execute('DELETE FROM pedido_items WHERE pedido_id = ?', [id]);
      await insertarItems(con, id, items);
      return buscarPedido(id, con);
    });
    res.json(pedido);
  }));

  // Cambiar solo el encabezado (cliente y/o comentario).
  r.patch('/:id', requiereSesion('admin'), asincrono(async (req, res) => {
    const id = validar(esquemaId, req.params.id);
    const d = validar(esquemaPedidoParcial, req.body);
    if (d.cliente_id === undefined && d.cliente_nombre === undefined && d.comentario === undefined) {
      throw new ErrorApi(400, 'No enviaste ningún campo para cambiar');
    }
    const pedido = await enTransaccion(async (con) => {
      await buscarPedido(id, con);
      if (d.cliente_id || d.cliente_nombre) {
        const cliente = await resolverCliente(con, d);
        await con.execute('UPDATE pedidos SET cliente_id = ?, cliente_nombre = ? WHERE id = ?',
          [cliente.cliente_id, cliente.cliente_nombre, id]);
      }
      if (d.comentario !== undefined) {
        await con.execute('UPDATE pedidos SET comentario = ? WHERE id = ?', [d.comentario, id]);
      }
      return buscarPedido(id, con);
    });
    res.json(pedido);
  }));

  // Borrado real (la tabla no tiene "activo"). Los items se borran solos (ON DELETE CASCADE).
  r.delete('/:id', requiereSesion('admin'), asincrono(async (req, res) => {
    const id = validar(esquemaId, req.params.id);
    await enTransaccion(async (con) => {
      const [facturas] = await con.execute('SELECT numero FROM facturas WHERE pedido_id = ? LIMIT 1', [id]);
      if (facturas.length) {
        throw new ErrorApi(409, `No se puede borrar: el pedido ya tiene la factura #${facturas[0].numero}`);
      }
      const [resultado] = await con.execute('DELETE FROM pedidos WHERE id = ?', [id]);
      if (!resultado.affectedRows) throw new ErrorApi(404, 'Pedido no encontrado');
    });
    res.status(204).end();
  }));

  return r;
}

module.exports = { crearRutasPedidos };
