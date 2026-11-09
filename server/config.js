'use strict';

// Configuración leída de variables de entorno. Aquí no van secretos.
const config = {
  port: Number(process.env.PORT) || 3000,
  isProduction: process.env.NODE_ENV === 'production',

  // TEMPORAL (fase 2): activa los usuarios sintéticos de server/usuarios-prueba.js.
  // Siempre activos en desarrollo; en producción solo si USUARIOS_PRUEBA=si.
  usuariosPrueba: process.env.NODE_ENV !== 'production' || process.env.USUARIOS_PRUEBA === 'si',
};

module.exports = config;
