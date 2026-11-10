'use strict';

/* ============================================================
   L&A FRUVER - Clientes
   Tabla: id (UUID), nombre (único), telefono, direccion, activo,
          creado_en, actualizado_en (UTC)
   GET    /api/clientes          lista paginada (?pagina, ?limite, ?q=texto, ?activo=si|no)
                                 Cada cliente trae "total_pedidos".
   GET    /api/clientes/:id      uno
   POST   /api/clientes          crear              (rol admin)
   PUT    /api/clientes/:id      reemplazar todo     (rol admin)
   PATCH  /api/clientes/:id      cambiar algunos     (rol admin)
   DELETE /api/clientes/:id      inhabilitar: activo = 0 (rol admin). No borra la fila
                                 (un cliente con pedidos no se puede borrar de verdad).
   ============================================================ */

const crypto = require('node:crypto');
const express = require('express');
const { z } = require('zod');
const { obtenerPool } = require('../db');
const {
  ErrorApi, asincrono, validar, esquemaId, esquemaPaginacion, sqlPaginacion,
  textoOpcional, textoLike, requiereSesion, sqlSet,
} = require('./comun');

const COLUMNAS = `c.id, c.nombre, c.telefono, c.direccion, c.activo, c.creado_en, c.actualizado_en,
  (SELECT COUNT(*) FROM pedidos pe WHERE pe.cliente_id = c.id) AS total_pedidos`;

const esquemaCliente = z.object({
  nombre: z.string({ error: 'El nombre es obligatorio' }).trim().min(1, 'El nombre es obligatorio').max(150),
  telefono: textoOpcional(30),
  direccion: textoOpcional(255),
  activo: z.boolean().optional(),
}).strict();

const esquemaFiltros = esquemaPaginacion.extend({
  q: z.string().trim().max(150).optional(),
  activo: z.enum(['si', 'no']).optional(),
});

function formatear(fila) {
  return { ...fila, activo: Boolean(fila.activo), total_pedidos: Number(fila.total_pedidos) };
}

async function buscarCliente(id) {
  const [filas] = await obtenerPool().execute(`SELECT ${COLUMNAS} FROM clientes c WHERE c.id = ?`, [id]);
  if (!filas.length) throw new ErrorApi(404, 'Cliente no encontrado');
  return formatear(filas[0]);
}

// El nombre es único en la tabla (sin distinguir mayúsculas ni tildes).
async function revisarNombreRepetido(nombre, idActual) {
  const [filas] = await obtenerPool().execute(
    'SELECT id FROM clientes WHERE nombre = ? AND id <> ? LIMIT 1', [nombre, idActual || '']);
  if (filas.length) throw new ErrorApi(409, 'Ya existe un cliente con ese nombre');
}

function crearRutasClientes() {
  const r = express.Router();

  r.get('/', requiereSesion(), asincrono(async (req, res) => {
    const f = validar(esquemaFiltros, req.query);
    const condiciones = [];
    const valores = [];
    if (f.q) { condiciones.push('c.nombre LIKE ?'); valores.push(textoLike(f.q)); }
    if (f.activo) { condiciones.push('c.activo = ?'); valores.push(f.activo === 'si' ? 1 : 0); }
    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';

    const db = obtenerPool();
    const [[{ total }]] = await db.execute(`SELECT COUNT(*) AS total FROM clientes c ${where}`, valores);
    const [filas] = await db.execute(
      `SELECT ${COLUMNAS} FROM clientes c ${where} ORDER BY c.nombre ${sqlPaginacion(f)}`, valores);

    res.json({ datos: filas.map(formatear), total: Number(total), pagina: f.pagina, limite: f.limite });
  }));

  r.get('/:id', requiereSesion(), asincrono(async (req, res) => {
    res.json(await buscarCliente(validar(esquemaId, req.params.id)));
  }));

  r.post('/', requiereSesion('admin'), asincrono(async (req, res) => {
    const d = validar(esquemaCliente, req.body);
    await revisarNombreRepetido(d.nombre);
    const id = crypto.randomUUID();
    await obtenerPool().execute(
      'INSERT INTO clientes (id, nombre, telefono, direccion, activo) VALUES (?, ?, ?, ?, ?)',
      [id, d.nombre, d.telefono ?? null, d.direccion ?? null, d.activo === false ? 0 : 1]);
    res.status(201).location(`/api/clientes/${id}`).json(await buscarCliente(id));
  }));

  // PUT reemplaza todo (lo que no envíes queda vacío); PATCH cambia solo lo enviado.
  const actualizar = (parcial) => asincrono(async (req, res) => {
    const id = validar(esquemaId, req.params.id);
    const d = validar(parcial ? esquemaCliente.partial() : esquemaCliente, req.body);
    await buscarCliente(id);
    if (d.nombre !== undefined) await revisarNombreRepetido(d.nombre, id);

    const campos = parcial ? d : {
      nombre: d.nombre, telefono: d.telefono ?? null, direccion: d.direccion ?? null, activo: d.activo ?? true,
    };
    const set = sqlSet(campos, ['activo']);
    if (set.vacio) throw new ErrorApi(400, 'No enviaste ningún campo para cambiar');

    await obtenerPool().execute(
      `UPDATE clientes SET ${set.sql}, actualizado_en = UTC_TIMESTAMP() WHERE id = ?`, [...set.valores, id]);
    res.json(await buscarCliente(id));
  });
  r.put('/:id', requiereSesion('admin'), actualizar(false));
  r.patch('/:id', requiereSesion('admin'), actualizar(true));

  r.delete('/:id', requiereSesion('admin'), asincrono(async (req, res) => {
    const id = validar(esquemaId, req.params.id);
    const [resultado] = await obtenerPool().execute(
      'UPDATE clientes SET activo = 0, actualizado_en = UTC_TIMESTAMP() WHERE id = ?', [id]);
    if (!resultado.affectedRows) throw new ErrorApi(404, 'Cliente no encontrado');
    res.status(204).end();
  }));

  return r;
}

module.exports = { crearRutasClientes };
