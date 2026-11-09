'use strict';

/* TEMPORAL (fase 2): usuarios SINTÉTICOS para probar el login mientras no exista la tabla
   de usuarios en MySQL (fase 3). Son datos inventados: los correos usan el dominio ".test",
   que está reservado y no existe en internet.
   Las contraseñas están aquí a la vista A PROPÓSITO, porque son de prueba. Por eso solo se
   activan fuera de producción, o en producción si .env tiene USUARIOS_PRUEBA=si.
   NUNCA pongas aquí un correo o una contraseña real. */
const USUARIOS_PRUEBA = [
  {
    email: 'admin@lyafruver.test',
    password: 'Admin-Prueba-2026',
    nombre: 'Administradora de prueba',
    rol: 'admin',
    activo: true,
  },
  {
    email: 'operario@lyafruver.test',
    password: 'Operario-Prueba-2026',
    nombre: 'Operario de prueba',
    rol: 'admin',
    activo: true,
  },
  {
    // Sirve para comprobar que un usuario desactivado NO puede entrar.
    email: 'inactivo@lyafruver.test',
    password: 'Inactivo-Prueba-2026',
    nombre: 'Usuario desactivado',
    rol: 'admin',
    activo: false,
  },
];

module.exports = { USUARIOS_PRUEBA };
