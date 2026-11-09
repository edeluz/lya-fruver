'use strict';

/* Login y sesiones (versión temporal de la fase 2, con usuarios sintéticos).
   - Las contraseñas se guardan en memoria como hash scrypt, nunca en texto plano.
   - La sesión es una cookie HttpOnly (JavaScript no la puede leer) y SameSite=Strict
     (otro sitio no puede usarla para hacer peticiones en tu nombre).
   - Las sesiones viven en memoria: al reiniciar el servidor hay que volver a ingresar.
   - Limita los intentos fallidos por IP.
   En la fase 3 los usuarios pasan a MySQL y las sesiones a una tabla. */

const crypto = require('node:crypto');
const express = require('express');
const config = require('./config');
const { USUARIOS_PRUEBA } = require('./usuarios-prueba');

const COOKIE = 'lya_sesion';
const DURACION_SESION_MS = 8 * 60 * 60 * 1000;   // 8 horas
const MAX_FALLOS = 5;
const VENTANA_FALLOS_MS = 15 * 60 * 1000;        // 15 minutos

// Rutas del panel que exigen sesión. Se comparan en minúsculas y decodificadas, para que
// "/ADMIN.HTML" o "/admin%2Ehtml" no se salten la protección.
const RUTAS_PROTEGIDAS = new Set(['/admin', '/admin.html', '/js/admin.js']);

/* ---------- Contraseñas ---------- */
function hashear(password, salt) {
  return crypto.scryptSync(password, salt, 64);
}

function crearUsuarios(lista) {
  const usuarios = new Map();
  for (const u of lista) {
    const salt = crypto.randomBytes(16);
    usuarios.set(u.email.toLowerCase(), {
      email: u.email.toLowerCase(), nombre: u.nombre, rol: u.rol, activo: u.activo,
      salt, hash: hashear(u.password, salt),
    });
  }
  return usuarios;
}

const usuarios = config.usuariosPrueba ? crearUsuarios(USUARIOS_PRUEBA) : new Map();
// Si el correo no existe se calcula igual un hash, para que la respuesta tarde lo mismo
// y no delate qué correos existen.
const SALT_FALSO = crypto.randomBytes(16);
const HASH_FALSO = hashear('contraseña-falsa', SALT_FALSO);

function verificar(email, password) {
  const usuario = usuarios.get(email);
  const hashIntento = hashear(password, usuario ? usuario.salt : SALT_FALSO);
  const coincide = crypto.timingSafeEqual(hashIntento, usuario ? usuario.hash : HASH_FALSO);
  return usuario && usuario.activo && coincide ? usuario : null;
}

/* ---------- Sesiones ---------- */
const sesiones = new Map();   // token -> { email, nombre, rol, expira }

function leerCookie(req, nombre) {
  for (const parte of (req.headers.cookie || '').split(';')) {
    const i = parte.indexOf('=');
    if (i > 0 && parte.slice(0, i).trim() === nombre) return parte.slice(i + 1).trim();
  }
  return null;
}

function sesionActual(req) {
  const token = leerCookie(req, COOKIE);
  if (!token) return null;
  const sesion = sesiones.get(token);
  if (!sesion) return null;
  if (sesion.expira < Date.now()) {
    sesiones.delete(token);
    return null;
  }
  return sesion;
}

function opcionesCookie() {
  return { httpOnly: true, sameSite: 'strict', secure: config.isProduction, path: '/' };
}

/* ---------- Límite de intentos fallidos ---------- */
const fallos = new Map();   // ip -> { cantidad, desde }

function bloqueado(ip) {
  const f = fallos.get(ip);
  if (!f) return false;
  if (Date.now() - f.desde > VENTANA_FALLOS_MS) {
    fallos.delete(ip);
    return false;
  }
  return f.cantidad >= MAX_FALLOS;
}

function registrarFallo(ip) {
  const f = fallos.get(ip);
  if (!f || Date.now() - f.desde > VENTANA_FALLOS_MS) fallos.set(ip, { cantidad: 1, desde: Date.now() });
  else f.cantidad += 1;
}

// Limpieza periódica de sesiones vencidas y contadores viejos.
setInterval(() => {
  const ahora = Date.now();
  for (const [token, s] of sesiones) if (s.expira < ahora) sesiones.delete(token);
  for (const [ip, f] of fallos) if (ahora - f.desde > VENTANA_FALLOS_MS) fallos.delete(ip);
}, 10 * 60 * 1000).unref();

/* ---------- Rutas /api ---------- */
function crearRutasAuth() {
  const router = express.Router();
  router.use(express.json({ limit: '10kb' }));

  router.post('/login', (req, res) => {
    if (bloqueado(req.ip)) {
      return res.status(429).json({ error: 'Demasiados intentos. Espera unos minutos.' });
    }
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if (!email || !password || email.length > 200 || password.length > 200) {
      return res.status(400).json({ error: 'Escribe tu correo y tu contraseña.' });
    }

    const usuario = verificar(email, password);
    if (!usuario) {
      registrarFallo(req.ip);
      return res.status(401).json({ error: 'Correo o contraseña incorrectos.' });
    }

    fallos.delete(req.ip);
    const token = crypto.randomBytes(32).toString('base64url');
    sesiones.set(token, {
      email: usuario.email, nombre: usuario.nombre, rol: usuario.rol,
      expira: Date.now() + DURACION_SESION_MS,
    });
    res.cookie(COOKIE, token, { ...opcionesCookie(), maxAge: DURACION_SESION_MS });
    return res.json({ ok: true });
  });

  // Responde 200 aunque no haya sesión: así el navegador no muestra un error en la consola.
  router.get('/sesion', (req, res) => {
    const s = sesionActual(req);
    res.set('Cache-Control', 'no-store');
    res.json({ usuario: s ? { email: s.email, nombre: s.nombre, rol: s.rol } : null });
  });

  router.post('/logout', (req, res) => {
    const token = leerCookie(req, COOKIE);
    if (token) sesiones.delete(token);
    res.clearCookie(COOKIE, opcionesCookie());
    res.json({ ok: true });
  });

  return router;
}

/* ---------- Protección del panel ---------- */
function protegerPanel(req, res, next) {
  let ruta;
  try {
    ruta = decodeURIComponent(req.path).toLowerCase().replace(/\/+$/, '');
  } catch {
    return res.status(400).type('text/plain').send('Solicitud no válida');
  }
  if (!RUTAS_PROTEGIDAS.has(ruta)) return next();

  const sesion = sesionActual(req);
  if (sesion && sesion.rol === 'admin') {
    res.set('Cache-Control', 'no-store');
    return next();
  }
  if (ruta.endsWith('.js')) return res.status(401).type('text/plain').send('Debes iniciar sesión');
  return res.redirect(302, '/login');
}

module.exports = { crearRutasAuth, protegerPanel };
