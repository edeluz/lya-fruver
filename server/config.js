'use strict';

// Configuración leída de variables de entorno. Aquí no van secretos.
const config = {
  port: Number(process.env.PORT) || 3000,
  isProduction: process.env.NODE_ENV === 'production',
};

module.exports = config;
