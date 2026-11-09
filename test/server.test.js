'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../server/app');

let server;
let baseUrl;

before(async () => {
  server = createApp().listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(() => server.close());

test('health check responde ok', async () => {
  const res = await fetch(`${baseUrl}/healthz`);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { status: 'ok' });
});

for (const page of ['/', '/index.html', '/cliente.html', '/admin.html', '/cliente', '/admin']) {
  test(`sirve la página ${page}`, async () => {
    const res = await fetch(baseUrl + page);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /text\/html/);
    assert.equal(res.headers.get('cache-control'), 'no-cache');
  });
}

for (const asset of [
  '/js/common.js', '/js/cliente.js', '/js/admin.js', '/css/fonts.css',
  '/vendor/chart.umd.min.js', '/vendor/html2canvas.min.js', '/vendor/xlsx.full.min.js',
  '/fonts/poppins-latin-700-normal.woff2', '/fonts/inter-latin-400-normal.woff2',
]) {
  test(`sirve el archivo ${asset}`, async () => {
    const res = await fetch(baseUrl + asset);
    assert.equal(res.status, 200, `${asset} debería existir (¿corriste npm run build?)`);
  });
}

test('las librerías se guardan en caché', async () => {
  const res = await fetch(`${baseUrl}/vendor/chart.umd.min.js`);
  assert.match(res.headers.get('cache-control'), /max-age=604800/);
});

test('envía cabeceras de seguridad', async () => {
  const res = await fetch(`${baseUrl}/`);
  const csp = res.headers.get('content-security-policy');
  assert.match(csp, /default-src 'self'/);
  assert.match(csp, /script-src 'self'(;|$)/, 'no debe permitir scripts en línea ni externos');
  assert.match(csp, /frame-ancestors 'none'/);
  assert.match(csp, /object-src 'none'/);
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(res.headers.get('x-powered-by'), null);
});

test('una ruta inexistente da 404 sin detalles internos', async () => {
  const res = await fetch(`${baseUrl}/no-existe`);
  assert.equal(res.status, 404);
  assert.equal(await res.text(), 'Página no encontrada');
});

test('no sirve archivos ocultos ni fuera de public', async () => {
  for (const path of ['/.env', '/%2e%2e/package.json', '/../server/app.js']) {
    const res = await fetch(baseUrl + path);
    assert.equal(res.status, 404, path);
  }
});

test('ninguna página carga scripts desde internet ni tiene scripts en línea', async () => {
  for (const page of ['/index.html', '/cliente.html', '/admin.html']) {
    const body = await (await fetch(baseUrl + page)).text();
    assert.doesNotMatch(body, /<script\s+src="https?:/i, `${page} carga un script externo`);
    assert.doesNotMatch(body, /<script>(?!<\/script>)/i, `${page} tiene un script en línea`);
    assert.doesNotMatch(body, /@import/i, `${page} usa @import`);
  }
});
