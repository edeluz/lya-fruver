'use strict';

/* ============================================================
   L&A FRUVER - Piezas compartidas por todas las unidades de negocio
   (errores, validación, paginación y permisos).
   ============================================================ */

const { z } = require('zod');
const { sesionActual } = require('../auth');
const { baseConfigurada } = require('../db');

// Error con código HTTP y mensaje seguro para mostrar al usuario.
class ErrorApi extends Error {
  constructor(status, mensaje, detalles) {
    super(mensaje);
    this.status = status;
    this.detalles = detalles;
  }
}

// Envuelve un manejador async para que sus errores lleguen al manejador de errores.
const asincrono = (fn) => (req, res, next) => fn(req, res, next).catch(next);

// Valida con zod; si falla responde 400 con la lista de campos con problema.
function validar(esquema, datos) {
  const r = esquema.safeParse(datos);
  if (!r.success) {
    const detalles = r.error.issues.map((i) => ({ campo: i.path.join('.') || '(cuerpo)', mensaje: i.message }));
    throw new ErrorApi(400, 'Datos no válidos', detalles);
  }
  return r.data;
}

const esquemaId = z.string().regex(
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, 'El id no es válido');

// ?pagina=1&limite=50 (máximo 200 por página)
const esquemaPaginacion = z.object({
  pagina: z.coerce.number().int().min(1).default(1),
  limite: z.coerce.number().int().min(1).max(200).default(50),
});

// LIMIT/OFFSET van en el texto porque ya son enteros validados por zod.
function sqlPaginacion({ pagina, limite }) {
  return `LIMIT ${limite} OFFSET ${(pagina - 1) * limite}`;
}

// Texto opcional: "" o null se guardan como NULL.
const textoOpcional = (max) => z.union([z.string().trim().max(max), z.null()])
  .optional()
  .transform((v) => (v === undefined ? undefined : v || null));

// Para búsquedas con LIKE: los caracteres % y _ se buscan tal cual.
function textoLike(texto) {
  return `%${texto.replace(/[\\%_]/g, '\\$&')}%`;
}

// "?, ?, ?" para usar en un IN (...) con una lista de valores.
function marcadores(lista) {
  return lista.map(() => '?').join(', ');
}

/* Arma el "SET col = ?, col2 = ?" de un UPDATE con los campos enviados (ignora los undefined).
   Las claves vienen siempre de un esquema zod .strict(), que rechaza columnas desconocidas.
   "booleanos": columnas true/false que se guardan como 1/0. */
function sqlSet(campos, booleanos = []) {
  const claves = Object.keys(campos).filter((k) => campos[k] !== undefined);
  return {
    vacio: claves.length === 0,
    sql: claves.map((k) => `${k} = ?`).join(', '),
    valores: claves.map((k) => (booleanos.includes(k) ? (campos[k] ? 1 : 0) : campos[k])),
  };
}

// Dinero con 2 decimales (evita 0.1 + 0.2 = 0.30000000000000004).
function redondear2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/* ---------- Fechas (Colombia = UTC-5 todo el año, sin horario de verano) ---------- */
const DESFASE_COLOMBIA_MS = 5 * 60 * 60 * 1000;

const esquemaFecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha debe tener el formato AAAA-MM-DD')
  .refine((s) => !Number.isNaN(Date.parse(`${s}T00:00:00Z`)), 'La fecha no es válida');

// Fecha de hoy en Colombia ("AAAA-MM-DD"). La del servidor (UTC) puede ser ya mañana.
function hoyColombia() {
  return new Date(Date.now() - DESFASE_COLOMBIA_MS).toISOString().slice(0, 10);
}

// Inicio de un día de Colombia expresado en UTC ("AAAA-MM-DD HH:MM:SS"), para comparar con
// columnas DATETIME guardadas en UTC (creado_en). sumarDias=1 da el inicio del día siguiente.
function inicioDiaColombiaUtc(fecha, sumarDias = 0) {
  const ms = Date.parse(`${fecha}T00:00:00Z`) + DESFASE_COLOMBIA_MS + sumarDias * 24 * 60 * 60 * 1000;
  return new Date(ms).toISOString().slice(0, 19).replace('T', ' ');
}

// Exige sesión iniciada (401) y, si se indica, uno de los roles permitidos (403).
function requiereSesion(...roles) {
  return (req, res, next) => {
    const sesion = sesionActual(req);
    if (!sesion) return res.status(401).json({ error: 'Debes iniciar sesión' });
    if (roles.length && !roles.includes(sesion.rol)) {
      return res.status(403).json({ error: 'No tienes permiso para esta acción' });
    }
    req.usuario = sesion;
    return next();
  };
}

// Si la base no está configurada, responde 503 en vez de fallar.
function requiereBase(req, res, next) {
  if (!baseConfigurada()) {
    return res.status(503).json({ error: 'La base de datos no está configurada' });
  }
  return next();
}

module.exports = {
  ErrorApi, asincrono, validar, esquemaId, esquemaPaginacion, sqlPaginacion,
  textoOpcional, textoLike, requiereSesion, requiereBase,
  marcadores, sqlSet, redondear2, esquemaFecha, hoyColombia, inicioDiaColombiaUtc,
};
