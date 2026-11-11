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

for (const page of ['/', '/login', '/login.html', '/index.html', '/cliente.html', '/cliente']) {
  test(`sirve la página ${page}`, async () => {
    const res = await fetch(baseUrl + page);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /text\/html/);
    assert.equal(res.headers.get('cache-control'), 'no-cache');
  });
}

test('la primera pantalla ("/") es el login', async () => {
  const body = await (await fetch(`${baseUrl}/`)).text();
  assert.match(body, /id="loginForm"/);
});

/* Inicia sesión con un usuario sintético y devuelve la cookie de sesión. */
async function iniciarSesion(email = 'admin@lyafruver.test', password = 'Admin-Prueba-2026') {
  const res = await fetch(`${baseUrl}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return { res, cookie: (res.headers.get('set-cookie') || '').split(';')[0] };
}

test('sin sesión, el panel manda al login y su JS no se entrega', async () => {
  for (const page of ['/admin', '/admin.html', '/ADMIN.HTML', '/admin%2Ehtml', '/admin/']) {
    const res = await fetch(baseUrl + page, { redirect: 'manual' });
    assert.equal(res.status, 302, page);
    assert.equal(res.headers.get('location'), '/login', page);
  }
  const js = await fetch(`${baseUrl}/js/admin.js`);
  assert.equal(js.status, 401);
});

test('login correcto: abre sesión y deja entrar al panel', async () => {
  const { res, cookie } = await iniciarSesion();
  assert.equal(res.status, 200);
  const setCookie = res.headers.get('set-cookie');
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /SameSite=Strict/i);

  for (const page of ['/admin', '/admin.html', '/js/admin.js']) {
    const r = await fetch(baseUrl + page, { headers: { cookie } });
    assert.equal(r.status, 200, page);
    assert.equal(r.headers.get('cache-control'), 'no-store', page);
  }
  const sesion = await (await fetch(`${baseUrl}/api/sesion`, { headers: { cookie } })).json();
  assert.equal(sesion.usuario.email, 'admin@lyafruver.test');
});

test('login incorrecto o usuario inactivo: mismo mensaje y sin sesión', async () => {
  for (const [email, password] of [
    ['admin@lyafruver.test', 'mala'],
    ['no-existe@lyafruver.test', 'Admin-Prueba-2026'],
    ['inactivo@lyafruver.test', 'Inactivo-Prueba-2026'],
  ]) {
    const { res } = await iniciarSesion(email, password);
    assert.equal(res.status, 401, email);
    assert.deepEqual(await res.json(), { error: 'Correo o contraseña incorrectos.' });
    assert.equal(res.headers.get('set-cookie'), null);
  }
});

test('sin sesión, /api/sesion responde sin usuario', async () => {
  const res = await fetch(`${baseUrl}/api/sesion`);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { usuario: null });
});

test('cerrar sesión invalida la cookie', async () => {
  const { cookie } = await iniciarSesion();
  await fetch(`${baseUrl}/api/logout`, { method: 'POST', headers: { cookie } });
  const res = await fetch(`${baseUrl}/admin.html`, { headers: { cookie }, redirect: 'manual' });
  assert.equal(res.status, 302);
});

for (const asset of [
  '/js/common.js', '/js/cliente.js', '/js/login.js', '/js/app.js', '/css/fonts.css', '/css/app.css',
  '/vendor/bootstrap/bootstrap.min.css', '/vendor/bootstrap/bootstrap.bundle.min.js', '/vendor/jquery.min.js',
  '/vendor/bootstrap-icons/bootstrap-icons.min.css', '/vendor/bootstrap-icons/fonts/bootstrap-icons.woff2',
  '/img/logo-login.png', '/img/logo-navbar.png', '/img/favicon-32.png', '/img/favicon-180.png',
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
  const { cookie } = await iniciarSesion();
  for (const page of ['/login.html', '/index.html', '/cliente.html', '/admin.html']) {
    const body = await (await fetch(baseUrl + page, { headers: { cookie } })).text();
    assert.doesNotMatch(body, /<script\s+src="https?:/i, `${page} carga un script externo`);
    assert.doesNotMatch(body, /<script>(?!<\/script>)/i, `${page} tiene un script en línea`);
    assert.doesNotMatch(body, /@import/i, `${page} usa @import`);
  }
});
