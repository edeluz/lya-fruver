'use strict';

/* ============================================================
   L&A FRUVER - Productos (catálogo) y qué proveedores surten cada uno
   Tablas: productos (id, nombre único, unidad, precio, disponible, creado_en)
           producto_proveedores (producto_id, proveedor_id)
   GET    /api/productos                  lista paginada (?pagina, ?limite, ?q=texto,
                                          ?disponible=si|no, ?proveedor_id=uuid)
                                          Cada producto trae "proveedores": [{ id, nombre }].
   GET    /api/productos/:id              uno, con sus proveedores
   POST   /api/productos                  crear (puede incluir "proveedores": [ids])   (rol admin)
   PUT    /api/productos/:id              reemplazar todo                               (rol admin)
   PATCH  /api/productos/:id              cambiar algunos campos                        (rol admin)
   PUT    /api/productos/:id/proveedores  reemplazar la lista de proveedores            (rol admin)
   DELETE /api/productos/:id              no lo borra: lo marca como NO disponible      (rol admin)
                                          (la tabla no tiene "activo"; "disponible" cumple ese papel)
   ============================================================ */

const crypto = require('node:crypto');
const express = require('express');
const { z } = require('zod');
const { obtenerPool, enTransaccion } = require('../db');
const {
  ErrorApi, asincrono, validar, esquemaId, esquemaPaginacion, sqlPaginacion,
  textoLike, requiereSesion, sqlSet, marcadores,
} = require('./comun');

const COLUMNAS = 'id, nombre, unidad, precio, disponible, creado_en';

const listaProveedores = z.array(esquemaId).max(200)
  .transform((ids) => [...new Set(ids.map((id) => id.toLowerCase()))]);

const esquemaProducto = z.object({
  nombre: z.string({ error: 'El nombre es obligatorio' }).trim().min(1, 'El nombre es obligatorio').max(150),
  unidad: z.string().trim().min(1).max(20).optional(),
  precio: z.number().min(0).max(999999999999).nullable().optional(),
  disponible: z.boolean().optional(),
  proveedores: listaProveedores.optional(),
}).strict();

const esquemaFiltros = esquemaPaginacion.extend({
  q: z.string().trim().max(150).optional(),
  disponible: z.enum(['si', 'no']).optional(),
  proveedor_id: esquemaId.optional(),
});

// Agrega a cada producto la lista de proveedores que lo surten (una sola consulta para todos).
async function agregarProveedores(db, productos) {
  if (!productos.length) return [];
  const ids = productos.map((p) => p.id);
  const [filas] = await db.execute(
    `SELECT pp.producto_id, pv.id, pv.nombre
     FROM producto_proveedores pp JOIN proveedores pv ON pv.id = pp.proveedor_id
     WHERE pp.producto_id IN (${marcadores(ids)}) ORDER BY pv.nombre`, ids);
  const porProducto = new Map();
  for (const f of filas) {
    if (!porProducto.has(f.producto_id)) porProducto.set(f.producto_id, []);
    porProducto.get(f.producto_id).push({ id: f.id, nombre: f.nombre });
  }
  return productos.map((p) => ({
    ...p, disponible: Boolean(p.disponible), proveedores: porProducto.get(p.id) || [],
  }));
}

async function buscarProducto(id, db = obtenerPool()) {
  const [filas] = await db.execute(`SELECT ${COLUMNAS} FROM productos WHERE id = ?`, [id]);
  if (!filas.length) throw new ErrorApi(404, 'Producto no encontrado');
  return (await agregarProveedores(db, filas))[0];
}

async function revisarNombreRepetido(db, nombre, idActual) {
  const [filas] = await db.execute(
    'SELECT id FROM productos WHERE nombre = ? AND id <> ? LIMIT 1', [nombre, idActual || '']);
  if (filas.length) throw new ErrorApi(409, 'Ya existe un producto con ese nombre');
}

// Reemplaza los proveedores de un producto (dentro de una transacción).
async function guardarProveedores(con, productoId, proveedores) {
  if (proveedores.length) {
    const [existen] = await con.execute(
      `SELECT id FROM proveedores WHERE id IN (${marcadores(proveedores)})`, proveedores);
    if (existen.length !== proveedores.length) throw new ErrorApi(400, 'Algún proveedor de la lista no existe');
  }
  await con.execute('DELETE FROM producto_proveedores WHERE producto_id = ?', [productoId]);
  for (const proveedorId of proveedores) {
    await con.execute(
      'INSERT INTO producto_proveedores (producto_id, proveedor_id) VALUES (?, ?)', [productoId, proveedorId]);
  }
}

function crearRutasProductos() {
  const r = express.Router();

  r.get('/', requiereSesion(), asincrono(async (req, res) => {
    const f = validar(esquemaFiltros, req.query);
    const condiciones = [];
    const valores = [];
    if (f.q) { condiciones.push('nombre LIKE ?'); valores.push(textoLike(f.q)); }
    if (f.disponible) { condiciones.push('disponible = ?'); valores.push(f.disponible === 'si' ? 1 : 0); }
    if (f.proveedor_id) {
      condiciones.push('id IN (SELECT producto_id FROM producto_proveedores WHERE proveedor_id = ?)');
      valores.push(f.proveedor_id);
    }
    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';

    const db = obtenerPool();
    const [[{ total }]] = await db.execute(`SELECT COUNT(*) AS total FROM productos ${where}`, valores);
    const [filas] = await db.execute(
      `SELECT ${COLUMNAS} FROM productos ${where} ORDER BY nombre ${sqlPaginacion(f)}`, valores);

    res.json({
      datos: await agregarProveedores(db, filas), total: Number(total), pagina: f.pagina, limite: f.limite,
    });
  }));

  r.get('/:id', requiereSesion(), asincrono(async (req, res) => {
    res.json(await buscarProducto(validar(esquemaId, req.params.id)));
  }));

  // Crear producto y sus proveedores: todo o nada.
  r.post('/', requiereSesion('admin'), asincrono(async (req, res) => {
    const d = validar(esquemaProducto, req.body);
    const id = crypto.randomUUID();
    const producto = await enTransaccion(async (con) => {
      await revisarNombreRepetido(con, d.nombre);
      await con.execute(
        'INSERT INTO productos (id, nombre, unidad, precio, disponible) VALUES (?, ?, ?, ?, ?)',
        [id, d.nombre, d.unidad ?? 'unidad', d.precio ?? null, d.disponible === false ? 0 : 1]);
      if (d.proveedores) await guardarProveedores(con, id, d.proveedores);
      return buscarProducto(id, con);
    });
    res.status(201).location(`/api/productos/${id}`).json(producto);
  }));

  // PUT reemplaza todo (lo que no envíes vuelve al valor por defecto); PATCH cambia solo lo enviado.
  // Si envías "proveedores", la lista de proveedores se reemplaza por la nueva.
  const actualizar = (parcial) => asincrono(async (req, res) => {
    const id = validar(esquemaId, req.params.id);
    const d = validar(parcial ? esquemaProducto.partial() : esquemaProducto, req.body);
    const { proveedores, ...resto } = d;
    const campos = parcial ? resto : {
      nombre: d.nombre, unidad: d.unidad ?? 'unidad', precio: d.precio ?? null, disponible: d.disponible ?? true,
    };
    const set = sqlSet(campos, ['disponible']);
    if (set.vacio && proveedores === undefined) throw new ErrorApi(400, 'No enviaste ningún campo para cambiar');

    const producto = await enTransaccion(async (con) => {
      await buscarProducto(id, con);
      if (campos.nombre !== undefined) await revisarNombreRepetido(con, campos.nombre, id);
      if (!set.vacio) await con.execute(`UPDATE productos SET ${set.sql} WHERE id = ?`, [...set.valores, id]);
      if (proveedores !== undefined) await guardarProveedores(con, id, proveedores);
      return buscarProducto(id, con);
    });
    res.json(producto);
  });
  r.put('/:id', requiereSesion('admin'), actualizar(false));
  r.patch('/:id', requiereSesion('admin'), actualizar(true));

  // Reemplazar solo los proveedores: { "proveedores": ["id1", "id2"] }. Lista vacía = ninguno.
  r.put('/:id/proveedores', requiereSesion('admin'), asincrono(async (req, res) => {
    const id = validar(esquemaId, req.params.id);
    const { proveedores } = validar(z.object({ proveedores: listaProveedores }).strict(), req.body);
    const producto = await enTransaccion(async (con) => {
      await buscarProducto(id, con);
      await guardarProveedores(con, id, proveedores);
      return buscarProducto(id, con);
    });
    res.json(producto);
  }));

  // No se borra (lo usan pedidos viejos): deja de aparecer en el formulario de pedidos.
  r.delete('/:id', requiereSesion('admin'), asincrono(async (req, res) => {
    const id = validar(esquemaId, req.params.id);
    const [resultado] = await obtenerPool().execute('UPDATE productos SET disponible = 0 WHERE id = ?', [id]);
    if (!resultado.affectedRows) throw new ErrorApi(404, 'Producto no encontrado');
    res.status(204).end();
  }));

  return r;
}

module.exports = { crearRutasProductos };
