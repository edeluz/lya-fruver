'use strict';

// Configuración leída de variables de entorno. Aquí no van secretos.

/* "si", "sí", "SI", "true", "1"... cuentan como sí. También quita comillas y espacios, por si
   el valor se copió de .env.example con comillas (en Easypanel las comillas quedan en el valor). */
function esSi(valor) {
  const limpio = String(valor || '').trim().replace(/^['"]|['"]$/g, '').trim().toLowerCase();
  return ['si', 'sí', 'true', '1', 'yes'].includes(limpio);
}

const isProduction = String(process.env.NODE_ENV || '').trim() === 'production';

const config = {
  port: Number(process.env.PORT) || 3000,
  isProduction,

  // TEMPORAL (fase 2): activa los usuarios sintéticos de server/usuarios-prueba.js.
  // Siempre activos en desarrollo; en producción solo si USUARIOS_PRUEBA=si.
  usuariosPrueba: !isProduction || esSi(process.env.USUARIOS_PRUEBA),
};

module.exports = config;
