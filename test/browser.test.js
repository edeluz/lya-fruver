'use strict';
/* Prueba las páginas en un navegador real (Chrome o Edge en modo invisible).
   Los datos se reemplazan por datos falsos: la prueba nunca toca los datos reales.
   Varios datos falsos traen código malicioso para comprobar que NO se ejecuta (XSS).
   Si no hay navegador instalado, la prueba se salta. Ruta propia: BROWSER_PATH=... */

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { createApp } = require('../server/app');

const BROWSER_CANDIDATES = [
  process.env.BROWSER_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);
const browserPath = BROWSER_CANDIDATES.find((p) => fs.existsSync(p));

let puppeteer = null;
try { puppeteer = require('puppeteer-core'); } catch { /* no instalado: se salta */ }
const skip = !browserPath || !puppeteer ? 'no hay navegador o puppeteer-core disponible' : false;

// Supabase se quitó y la API con MySQL aún no existe: estas pruebas no tienen de dónde leer datos.
const PENDIENTE_API = 'pendiente: API con MySQL (se quitó Supabase)';

const XSS = '<img src=x onerror="window.__xss=1">';
const FAKE = {
  productos: [
    { id: 'p1', nombre: `Tomate ${XSS}`, unidad: 'kg', precio: 1000, disponible: true },
  ],
  clientes: [
    { id: 'c1', nombre: `Tienda ${XSS}`, telefono: '300', direccion: 'Calle 1', activo: true, creado_en: '2026-11-09T01:00:00+00:00' },
  ],
  proveedores: [],
  producto_proveedores: [],
  pedido_items: [{
    producto_id: 'p9', producto_nombre: 'Papa vieja', cantidad: 2, unidad: 'kg', observacion: XSS, pedido_id: 'o1',
    pedidos: {
      id: 'o1', cliente_id: 'c1', cliente_nombre: `<svg onload="window.__xss=1">`,
      // 02:00 UTC del 9 de noviembre = 21:00 del 8 de noviembre en Colombia.
      creado_en: '2026-11-09T02:00:00+00:00', comentario: '<script>window.__xss=1</script>', origen: 'cliente',
    },
  }],
  pedidos: [{ id: 'o1', cliente_id: 'c1', cliente_nombre: `Tienda ${XSS}`, creado_en: '2026-11-09T02:00:00+00:00', comentario: null, clientes: { telefono: '300', direccion: 'Calle 1' } }],
  facturas: [{ id: 'f1', numero: 7, cliente_nombre: `Cliente ${XSS}`, fecha: '2026-11-09', total: 5000, flete: 0, cliente_telefono: null, cliente_direccion: null }],
  factura_items: [{ producto_nombre: `Mango ${XSS}`, cantidad: 5, unidad: 'kg', subtotal: 5000 }],
};

let server;
let baseUrl;
let browser;

before(async () => {
  if (skip) return;
  server = createApp().listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  browser = await puppeteer.launch({ executablePath: browserPath, headless: true, args: ['--no-first-run'] });
});

after(async () => {
  if (browser) await browser.close();
  if (server) server.close();
});

/* Abre una página con datos falsos y registra errores, violaciones de CSP y XSS. */
async function openPage(path) {
  const page = await browser.newPage();
  await page.emulateTimezone('America/Bogota');
  const problems = [];
  const writes = [];
  page.on('dialog', (dialog) => { problems.push(`aviso: ${dialog.message()}`); dialog.dismiss(); });
  page.on('pageerror', (err) => problems.push(`pageerror: ${err.message}`));
  page.on('console', (msg) => { if (msg.type() === 'error') problems.push(`console: ${msg.text()}`); });
  await page.evaluateOnNewDocument(() => {
    document.addEventListener('securitypolicyviolation', (e) => {
      console.error(`CSP bloqueó ${e.blockedURI} (${e.violatedDirective})`);
    });
  });
  // PENDIENTE: cuando exista la API con MySQL, interceptar aquí sus rutas (/api/...)
  // y responder con FAKE, registrando en "writes" lo que se guarda.
  await page.goto(baseUrl + path, { waitUntil: 'networkidle0' });
  return { page, problems, writes };
}

async function assertNoXss(page) {
  const result = await page.evaluate(() => ({
    flag: window.__xss,
    injected: document.querySelectorAll('img[src="x"], svg[onload], #filasPedidoModal script, main script').length,
  }));
  assert.equal(result.flag, undefined, 'se ejecutó código inyectado');
  assert.equal(result.injected, 0, 'se creó HTML inyectado');
}

test('portada: carga fuentes propias sin errores', { skip }, async () => {
  const { page, problems } = await openPage('/');
  await page.evaluate(() => document.fonts.ready);
  const loaded = await page.evaluate(() => [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family));
  assert.ok(loaded.some((f) => f.includes('Poppins')), 'Poppins no cargó');
  assert.ok(loaded.some((f) => f.includes('Inter')), 'Inter no cargó');
  assert.deepEqual(problems, []);
  await page.close();
});

test('formulario de cliente: muestra datos escapados y envía el pedido', { skip: skip || PENDIENTE_API }, async () => {
  const { page, problems, writes } = await openPage('/cliente.html');
  const optionText = await page.$eval('#clienteSelect option[value="c1"]', (o) => o.textContent);
  assert.equal(optionText, `Tienda ${XSS}`, 'el nombre debe verse como texto');
  await assertNoXss(page);

  await page.select('#clienteSelect', 'c1');
  await page.select('.prod-select', 'p1');
  await page.type('.cant-input', '3');
  await page.click('#btnEnviar');
  await page.waitForSelector('#successSection:not(.hidden)', { timeout: 5000 });
  assert.deepEqual(writes.map((w) => w.table), ['pedidos', 'pedido_items']);
  const item = JSON.parse(writes[1].body)[0];
  assert.equal(item.producto_id, 'p1');
  assert.equal(item.cantidad, 3);
  assert.equal(item.unidad, 'kg');
  assert.deepEqual(problems, []);
  await page.close();
});

test('panel: pedidos, edición, reportes y facturas sin XSS ni errores', { skip: skip || PENDIENTE_API }, async () => {
  const { page, problems } = await openPage('/admin.html');

  // Librerías locales cargadas
  const libs = await page.evaluate(() => [typeof XLSX, typeof Chart, typeof html2canvas]);
  assert.deepEqual(libs, ['object', 'function', 'function']);

  // Pedidos: el comentario y la observación se muestran como texto
  const pedidoText = await page.$eval('#listaPedidosIndividuales', (el) => el.textContent);
  assert.ok(pedidoText.includes('<script>window.__xss=1</script>'));
  await assertNoXss(page);

  // Editar pedido: un producto ya no disponible se conserva (no se cambia por otro)
  await page.click('.btn-editar-pedido');
  await page.waitForSelector('#modalPedidoBg.show');
  const selected = await page.$eval('.fila-producto', (s) => s.options[s.selectedIndex].textContent);
  assert.equal(selected, 'Papa vieja (no disponible)');
  await page.click('#btnCancelarPedidoModal');

  // Excel funciona con las reglas de seguridad (CSP)
  const xlsxBytes = await page.evaluate(() => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['a', 1]]), 'x');
    return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }).byteLength;
  });
  assert.ok(xlsxBytes > 0);

  // Reportes: el pedido de las 9 p. m. del 8 de noviembre cuenta en el día 8, no en el 9
  await page.click('.nav-btn[data-page="reportes"]');
  await page.click('#btnGenerarReporte');
  await page.waitForFunction(() => window.__chartTendencia, { timeout: 5000 })
    .catch((err) => { throw new Error(`${err.message}. Problemas: ${problems.join(' | ')}`); });
  const dias = await page.evaluate(() => window.__chartTendencia.data.labels);
  assert.deepEqual(dias, ['2026-11-08']);
  const inactivos = await page.$eval('#tbodyClientesInactivos', (el) => el.textContent.trim());
  assert.equal(inactivos, 'Todos tus clientes pidieron en este rango.');
  await assertNoXss(page);

  // Facturas: la fecha 2026-11-09 se muestra como 9/11/2026 (antes salía 8/11/2026)
  await page.click('.nav-btn[data-page="facturacion"]');
  await page.waitForSelector('.btn-ver-factura');
  const fechaLista = await page.$eval('#tbodyFacturas tr td:nth-child(3)', (td) => td.textContent);
  assert.equal(fechaLista, '9/11/2026');
  await page.click('.btn-ver-factura');
  await page.waitForSelector('#modalFacturaBg.show');
  assert.equal(await page.$eval('#pfFecha', (el) => el.textContent), '9/11/2026');
  await assertNoXss(page);

  // Imagen de la factura (html2canvas) funciona con la CSP
  const imageOk = await page.evaluate(async () => {
    const canvas = await html2canvas(document.getElementById('facturaImprimible'), { scale: 1 });
    return canvas.toDataURL('image/jpeg').startsWith('data:image/jpeg');
  });
  assert.ok(imageOk);
  await page.click('#btnCerrarFactura');

  // Las secciones con listas vacías ya no muestran error
  await page.click('.nav-btn[data-page="proveedores"]');
  await page.waitForFunction(() => document.querySelector('#tbodyProveedores').textContent.includes('No tienes proveedores'));
  assert.equal(await page.$eval('#alertProveedores', (el) => el.textContent), '');

  assert.deepEqual(problems, []);
  await page.close();
});
