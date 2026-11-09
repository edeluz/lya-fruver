'use strict';
/* Utilidades compartidas por cliente.html y admin.html. */

const UNIT_OPTIONS = ['unidad','kg','g','lb','arroba','caja','bulto','atado','canasta','docena','paquete','bolsa'];

/* ---------- HTML seguro ----------
   Todo dato que va dentro de html`...` se escapa automáticamente (evita XSS).
   Solo el HTML escrito en el código queda como HTML. Ejemplo:
     setHtml(el, html`<td>${cliente.nombre}</td>`)
   Si cliente.nombre fuera "<script>…", se mostraría como texto, no se ejecutaría. */
class SafeHtml {
  constructor(value){ this.value = value; }
  toString(){ return this.value; }
}

function escapeHtml(text){
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderValue(value){
  if(value instanceof SafeHtml) return value.value;
  if(Array.isArray(value)) return value.map(renderValue).join('');
  if(value === null || value === undefined || value === false) return '';
  return escapeHtml(value);
}

function html(strings, ...values){
  let out = strings[0];
  for(let i = 0; i < values.length; i++) out += renderValue(values[i]) + strings[i + 1];
  return new SafeHtml(out);
}

/* Únicas formas de poner HTML en la página. Un texto normal (no html`...`) se escapa. */
function setHtml(element, content){ element.innerHTML = renderValue(content); }
function appendHtml(element, content){ element.insertAdjacentHTML('beforeend', renderValue(content)); }

/* ---------- Fechas ---------- */
function pad2(n){ return String(n).padStart(2, '0'); }

/* "2026-11-09" a partir de una fecha, usando la hora local (Colombia), no la hora UTC. */
function localDateKey(value){
  const d = value instanceof Date ? value : new Date(value);
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}

/* Convierte "2026-11-09" en una fecha local. new Date("2026-11-09") la toma como UTC
   y en Colombia mostraría el día anterior. */
function parseDateOnly(value){
  const [y, m, d] = String(value).slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}
