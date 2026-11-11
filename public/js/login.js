'use strict';
/* Pantalla de ingreso (login.html). La contraseña se revisa en el servidor (/api/login),
   nunca en el navegador. La sesión queda en una cookie que JavaScript no puede leer. */

const DESTINO = 'admin.html';   // a dónde ir después de ingresar

const form = document.getElementById('loginForm');
const msg = document.getElementById('msg');
const btn = document.getElementById('btnIngresar');
const emailEl = document.getElementById('email');
const passEl = document.getElementById('password');

function mostrar(texto, tipo){
  msg.textContent = texto;
  msg.className = 'msg show ' + tipo;
}
function limpiar(){ msg.className = 'msg'; msg.textContent = ''; }

/* Mostrar / ocultar contraseña */
document.getElementById('togglePass').addEventListener('click', function(){
  const oculto = passEl.type === 'password';
  passEl.type = oculto ? 'text' : 'password';
  this.textContent = oculto ? 'Ocultar' : 'Mostrar';
});

/* Si ya hay una sesión abierta, entra directo */
(async function revisarSesion(){
  try{
    const res = await fetch('/api/sesion', { credentials: 'same-origin' });
    const data = await res.json();
    if(data && data.usuario) window.location.replace(DESTINO);
  }catch(e){ /* sin sesión: se queda en el login */ }
})();

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
    // Una sola línea: "Versión 1.0.0 · Build 20261111-1403 · Desplegado: 11/11/26, 2:04 p. m."
    const partes = [`Versión ${v.version}`];
    if(v.build) partes.push(`Build ${v.build}`);
    if(v.inicio) partes.push(`Desplegado: ${fecha(v.inicio)}`);
    caja.textContent = partes.join(' · ');   // textContent: nunca se interpreta como HTML
  }catch(e){ /* sin versión: no pasa nada */ }
})();

form.addEventListener('submit', async (e)=>{
  e.preventDefault();
  limpiar();

  const email = emailEl.value.trim();
  const password = passEl.value;

  if(!email || !password){
    mostrar('Escribe tu correo y tu contraseña.', 'err');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Ingresando…';

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
      mostrar('Correo o contraseña incorrectos. Inténtalo de nuevo.', 'err');
      passEl.value = '';
      passEl.focus();
    }
  }catch(err){
    mostrar('No se pudo conectar. Revisa tu conexión a internet e inténtalo de nuevo.', 'err');
  }

  btn.disabled = false;
  btn.textContent = 'Ingresar';
});
