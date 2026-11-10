'use strict';

/* ============================================================
   L&A FRUVER - Proveedores
   Tabla: id (UUID), nombre, telefono, direccion, notas, activo,
          creado_en, actualizado_en (UTC)
   GET    /api/proveedores          lista paginada (?pagina, ?limite, ?q=texto, ?activo=si|no)
   GET    /api/proveedores/:id      uno
   POST   /api/proveedores          crear              (rol admin)
   PUT    /api/proveedores/:id      reemplazar todo     (rol admin)
   PATCH  /api/proveedores/:id      cambiar algunos     (rol admin)
   DELETE /api/proveedores/:id      inhabilitar: activo = 0 (rol admin). No borra la fila.
   ============================================================ */

const crypto = require('node:crypto');
const express = require('express');
const { z } = require('zod');
const { obtenerPool } = require('../db');
const {
  ErrorApi, asincrono, validar, esquemaId, esquemaPaginacion, sqlPaginacion,
  textoOpcional, textoLike, requiereSesion,
} = require('./comun');

const COLUMNAS = 'id, nombre, telefono, direccion, notas, activo, creado_en, actualizado_en';

const esquemaProveedor = z.object({
  nombre: z.string({ error: 'El nombre es obligatorio' }).trim().min(1, 'El nombre es obligatorio').max(150),
  telefono: textoOpcional(30),
  direccion: textoOpcional(255),
  notas: textoOpcional(2000),
  activo: z.boolean().optional(),
}).strict();

const esquemaFiltros = esquemaPaginacion.extend({
  q: z.string().trim().max(150).optional(),
  activo: z.enum(['si', 'no']).optional(),
});

// MariaDB devuelve activo como 0/1: se convierte a true/false.
function formatear(fila) {
  return { ...fila, activo: Boolean(fila.activo) };
}

async function buscarProveedor(id) {
  const [filas] = await obtenerPool().execute(`SELECT ${COLUMNAS} FROM proveedores WHERE id = ?`, [id]);
  if (!filas.length) throw new ErrorApi(404, 'Proveedor no encontrado');
  return formatear(filas[0]);
}

// Nombre repetido (sin distinguir mayúsculas ni tildes): 409 si ya lo tiene otro proveedor.
async function revisarNombreRepetido(nombre, idActual) {
  const [filas] = await obtenerPool().execute(
    'SELECT id FROM proveedores WHERE nombre = ? AND id <> ? LIMIT 1', [nombre, idActual || '']);
  if (filas.length) throw new ErrorApi(409, 'Ya existe un proveedor con ese nombre');
}

function crearRutasProveedores() {
  const r = express.Router();

  r.get('/', requiereSesion(), asincrono(async (req, res) => {
    const f = validar(esquemaFiltros, req.query);
    const condiciones = [];
    const valores = [];
    if (f.q) { condiciones.push('nombre LIKE ?'); valores.push(textoLike(f.q)); }
    if (f.activo) { condiciones.push('activo = ?'); valores.push(f.activo === 'si' ? 1 : 0); }
    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';

    const db = obtenerPool();
    const [[{ total }]] = await db.execute(`SELECT COUNT(*) AS total FROM proveedores ${where}`, valores);
    const [filas] = await db.execute(
      `SELECT ${COLUMNAS} FROM proveedores ${where} ORDER BY nombre ${sqlPaginacion(f)}`, valores);

    res.json({ datos: filas.map(formatear), total: Number(total), pagina: f.pagina, limite: f.limite });
  }));

  r.get('/:id', requiereSesion(), asincrono(async (req, res) => {
    res.json(await buscarProveedor(validar(esquemaId, req.params.id)));
  }));

  r.post('/', requiereSesion('admin'), asincrono(async (req, res) => {
    const d = validar(esquemaProveedor, req.body);
    await revisarNombreRepetido(d.nombre);
    const id = crypto.randomUUID();
    await obtenerPool().execute(
      `INSERT INTO proveedores (id, nombre, telefono, direccion, notas, activo)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, d.nombre, d.telefono ?? null, d.direccion ?? null, d.notas ?? null, d.activo === false ? 0 : 1]);
    res.status(201).location(`/api/proveedores/${id}`).json(await buscarProveedor(id));
  }));

  // PUT reemplaza todo (los campos que no envíes quedan vacíos); PATCH cambia solo lo enviado.
  const actualizar = (parcial) => asincrono(async (req, res) => {
    const id = validar(esquemaId, req.params.id);
    const d = validar(parcial ? esquemaProveedor.partial() : esquemaProveedor, req.body);
    await buscarProveedor(id);   // 404 si no existe
    if (d.nombre !== undefined) await revisarNombreRepetido(d.nombre, id);

    const campos = parcial ? d : {
      nombre: d.nombre, telefono: d.telefono ?? null, direccion: d.direccion ?? null,
      notas: d.notas ?? null, activo: d.activo ?? true,
    };
    // Solo columnas conocidas: las claves vienen del esquema zod, que rechaza las demás.
    const claves = Object.keys(campos).filter((k) => campos[k] !== undefined);
    if (!claves.length) throw new ErrorApi(400, 'No enviaste ningún campo para cambiar');
    const valores = claves.map((k) => (k === 'activo' ? (campos[k] ? 1 : 0) : campos[k]));

    await obtenerPool().execute(
      `UPDATE proveedores SET ${claves.map((k) => `${k} = ?`).join(', ')}, actualizado_en = UTC_TIMESTAMP()
       WHERE id = ?`, [...valores, id]);
    res.json(await buscarProveedor(id));
  });
  r.put('/:id', requiereSesion('admin'), actualizar(false));
  r.patch('/:id', requiereSesion('admin'), actualizar(true));

  // Borrado lógico: el proveedor queda inhabilitado (activo = 0) y conserva su historial.
  r.delete('/:id', requiereSesion('admin'), asincrono(async (req, res) => {
    const id = validar(esquemaId, req.params.id);
    const [resultado] = await obtenerPool().execute(
      'UPDATE proveedores SET activo = 0, actualizado_en = UTC_TIMESTAMP() WHERE id = ?', [id]);
    if (!resultado.affectedRows) throw new ErrorApi(404, 'Proveedor no encontrado');
    res.status(204).end();
  }));

  return r;
}

module.exports = { crearRutasProveedores };
