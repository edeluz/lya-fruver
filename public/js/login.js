'use strict';
/* Pantalla de ingreso (login.html). La contraseña se revisa en el servidor (/api/login),
   nunca en el navegador. La sesión queda en una cookie que JavaScript no puede leer. */

const DESTINO = 'admin.html';   // a dónde ir después de ingresar

const form = document.getElementById('loginForm');
const msg = document.getElementById('msg');
const btn = document.getElementById('btnIngresar');
const emailEl = document.getElementById('email');
const passEl = document.getElementById('password');

const btnTexto = btn.querySelector('span');

/* Mensajes con las alertas de Bootstrap. tipo: 'err' (rojo) u 'ok' (verde).
   "campos": los que se marcan en rojo (is-invalid) junto al mensaje de error. */
function mostrar(texto, tipo, campos = []){
  msg.textContent = texto;   // textContent: nunca se interpreta como HTML
  msg.className = 'alert ' + (tipo === 'ok' ? 'alert-success' : 'alert-danger');
  campos.forEach((c)=> c.classList.add('is-invalid'));
}
function limpiar(){
  msg.className = 'alert d-none';
  msg.textContent = '';
  [emailEl, passEl].forEach((c)=> c.classList.remove('is-invalid'));
}
// Al escribir de nuevo en un campo marcado, se quita la marca roja.
[emailEl, passEl].forEach((c)=> c.addEventListener('input', ()=> c.classList.remove('is-invalid')));

/* Mostrar / ocultar contraseña (cambia el ícono del ojo y el texto) */
document.getElementById('togglePass').addEventListener('click', function(){
  const oculto = passEl.type === 'password';
  passEl.type = oculto ? 'text' : 'password';
  this.querySelector('span').textContent = oculto ? 'Ocultar' : 'Mostrar';
  this.querySelector('i').className = oculto ? 'bi bi-eye-slash' : 'bi bi-eye';
});

/* Si ya hay una sesión abierta, entra directo */
(async function revisarSesion(){
  try{
    const res = await fetch('/api/sesion', { credentials: 'same-origin' });
    const data = await res.json();
    if(data && data.usuario) window.location.replace(DESTINO);
  }catch(e){ /* sin sesión: se queda en el login */ }
})();

/* Ambiente, deducido solo de la dirección que tiene el navegador (no se configura nada):
   - localhost / 127.0.0.1           → Local (tu computador)
   - IP de red interna (192.168.x…)  → Red local
   - otra IP (por ejemplo la del VPS) → Servidor (IP)
   - dominio con "test", "prueba", "dev" o "staging" → Pruebas
   - cualquier otro dominio          → Producción */
function ambienteDelNavegador(){
  const host = window.location.hostname.toLowerCase();
  if(host === 'localhost' || host.endsWith('.localhost') || host === '[::1]' || host === '::1' || /^127\./.test(host)) return 'Local';
  if(/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)) return 'Red local';
  if(/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return 'Servidor (IP)';
  if(/(^|[.-])(test|prueba|pruebas|dev|staging|qa)([.-]|$)/.test(host)) return 'Pruebas';
  return 'Producción';
}

/* Versión y fechas de build/despliegue, abajo de la tarjeta. Si falla, no se muestra nada. */
(async function mostrarVersion(){
  const caja = document.getElementById('infoVersion');
  if(!caja) return;
  const fecha = (iso)=> iso ? new Date(iso).toLocaleString('es-CO', {
    timeZone: 'America/Bogota', dateStyle: 'short', timeStyle: 'short',
  }) : null;
  try{
    const res = await fetch('/api/version', { credentials: 'same-origin' });
    if(!res.ok) return;
    const v = await res.json();
    // Una sola línea: "Versión 1.0.0 · Build 20261111-1403 · Desplegado: 11/11/26, 2:04 p. m. · Env=Local"
    const partes = [`Versión ${v.version}`];
    if(v.build) partes.push(`Build ${v.build}`);
    if(v.inicio) partes.push(`Desplegado: ${fecha(v.inicio)}`);
    partes.push(`Env=${ambienteDelNavegador()}`);
    caja.textContent = partes.join(' · ');   // textContent: nunca se interpreta como HTML
  }catch(e){ /* sin versión: no pasa nada */ }
})();

form.addEventListener('submit', async (e)=>{
  e.preventDefault();
  limpiar();

  const email = emailEl.value.trim();
  const password = passEl.value;

  if(!email || !password){
    const faltan = [!email && emailEl, !password && passEl].filter(Boolean);
    mostrar(faltan.length === 2 ? 'Escribe tu correo y tu contraseña.'
      : (!email ? 'Escribe tu correo electrónico.' : 'Escribe tu contraseña.'), 'err', faltan);
    faltan[0].focus();
    return;
  }

  btn.disabled = true;
  btnTexto.textContent = 'Ingresando…';

  try{
    const res = await fetch('/api/login', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if(res.ok){
      mostrar('Ingreso correcto. Entrando…', 'ok');
      window.location.replace(DESTINO);
      return;
    }
    if(res.status === 429){
      mostrar('Demasiados intentos fallidos. Espera unos minutos e inténtalo de nuevo.', 'err');
    } else {
      // Mensaje único: no revela si el correo existe o no
      mostrar('Correo o contraseña incorrectos. Inténtalo de nuevo.', 'err', [emailEl, passEl]);
      passEl.value = '';
      passEl.focus();
    }
  }catch(err){
    mostrar('No se pudo conectar. Revisa tu conexión a internet e inténtalo de nuevo.', 'err');
  }

  btn.disabled = false;
  btnTexto.textContent = 'Ingresar';
});
