# Sistema de diseño — L&A Fruver

Guía para que todas las páginas se vean iguales. Basada en la "Identidad visual Fruver 2026"
de la versión anterior de la app (solo el estilo; no se usa su código) y en el logo real.

## Archivos

| Archivo | Para qué |
|---|---|
| `public/vendor/bootstrap/` | Bootstrap 5 (CSS y JS). Se copia con `npm run build` |
| `public/vendor/bootstrap-icons/` | Íconos (`<i class="bi bi-...">`). Se copia con `npm run build` |
| `public/vendor/jquery.min.js` | jQuery. Se copia con `npm run build` |
| `public/css/fonts.css` | Fuentes Inter y Poppins (locales, sin Google Fonts) |
| `public/css/app.css` | **Sistema de diseño**: variables de marca y ajustes a Bootstrap |
| `public/js/app.js` | JS propio común: `App.api()` (AJAX) y `App.aviso()` (toasts) |
| `public/img/` | Logo original y sus versiones optimizadas |
| `scripts/logo.js` | Regenera las versiones del logo: `node scripts/logo.js` |

Orden de carga en cada página:

```html
<link rel="stylesheet" href="vendor/bootstrap/bootstrap.min.css">
<link rel="stylesheet" href="vendor/bootstrap-icons/bootstrap-icons.min.css">
<link rel="stylesheet" href="css/fonts.css">
<link rel="stylesheet" href="css/app.css">
...
<script src="vendor/jquery.min.js"></script>
<script src="vendor/bootstrap/bootstrap.bundle.min.js"></script>
<script src="js/common.js"></script>
<script src="js/app.js"></script>
<script src="js/<pagina>.js"></script>
```

Nada de CDN: la política de seguridad (CSP) solo permite archivos de este mismo servidor.

## Paleta

| Variable | Color | Uso |
|---|---|---|
| `--fr-verde` | `#137548` | Color principal: botones, enlaces, foco |
| `--fr-verde-oscuro` | `#095d38` | Hover, títulos de sección |
| `--fr-lima` | `#8fbe3f` | Acentos, degradados, bordes destacados |
| `--fr-amarillo` | `#ffc934` | Acento de marca, botón `.btn-warning` |
| `--fr-naranja` | `#f28b35` | Alertas suaves, final de la franja |
| `--fr-menta` | `#eaf7ee` | Fondos suaves, chips, hover de botones claros |
| `--fr-tinta` | `#14382b` | Texto principal |
| `--fr-gris` | `#66776f` | Texto secundario |
| `--fr-linea` | `#dce9df` | Bordes y separadores |
| `--fr-peligro` | `#c74444` | Errores, eliminar |
| `--fr-franja` | verde → lima → amarillo → naranja | Franja superior de tarjetas destacadas |

Las variables de Bootstrap (`--bs-primary`, `--bs-body-color`, …) ya apuntan a estos colores.

## Tipografía

- **Títulos** (`h1`, `h2`, `h3`, `.fr-titulo`): Georgia (serif), negrita, letras algo juntas.
  Georgia viene instalada en Windows, Mac, Android e iOS: no hay que descargarla.
- **Texto, campos y botones**: Inter (local).
- **Etiqueta sobre títulos**: `.fr-etiqueta` — mayúsculas verdes, 11 px, espaciadas ("PANEL PRIVADO").

## Formas y sombras

| Variable | Valor | Uso |
|---|---|---|
| `--fr-radio` | 12 px | Campos y botones |
| `--fr-radio-lg` | 20 px | Tarjetas |
| `--fr-radio-xl` | 24 px | Tarjeta del login |
| `--fr-sombra` | verde suave | Tarjetas |
| `--fr-sombra-hover` | más marcada | Tarjetas al pasar el mouse |
| `--fr-halo-foco` | halo verde 4 px | Campo con el cursor |

## Componentes

- **Botón principal**: `.btn.btn-primary` → degradado verde con sombra; sube 1 px al pasar el mouse.
- **Botón secundario**: `.btn.btn-secondary` → fondo menta, texto verde.
- **Botón amarillo**: `.btn.btn-warning`.
- **Eliminar / inactivar**: `.btn.btn-outline-danger` → fondo rosado suave, rojo al pasar el mouse.
- **Botones con ícono**: `<button class="btn btn-primary"><i class="bi bi-plus-lg"></i> Agregar</button>`.
- **Campos**: `.form-label` + `.form-control` / `.form-select` (alto 46 px, halo verde al enfocar).
  Error: agregar `.is-invalid` al campo.
- **Tarjetas**: `.card` (radio 20 px, sombra verde suave).
- **Mensajes en la página**: `.alert.alert-danger` / `.alert.alert-success`.
- **Opción grande con ícono** (portada): `<a class="fr-opcion">` con `.fr-opcion-icono`
  (menta; `.fr-opcion-icono-amarillo` para la variante amarilla), `.fr-opcion-texto`
  (`<strong>` + `<small>`) y `.fr-opcion-flecha`.
- **Pantalla centrada con tarjeta** (login y portada): `<body class="fr-login">` +
  `.fr-login-wrap` + `.fr-login-card`.
- **Avisos flotantes**: `App.aviso('Guardado', 'ok')` / `App.aviso('No se pudo guardar', 'error')`.

Íconos sugeridos (Bootstrap Icons): ingresar `bi-box-arrow-in-right`, salir `bi-box-arrow-right`,
agregar `bi-plus-lg`, guardar `bi-check-lg`, editar `bi-pencil`, eliminar `bi-trash`,
buscar `bi-search`, ver contraseña `bi-eye` / `bi-eye-slash`, pedidos `bi-basket`,
catálogo `bi-box-seam`, proveedores `bi-truck`, clientes `bi-people`, facturas `bi-receipt`,
reportes `bi-bar-chart`.

## Logo

- Original: `public/img/logo-fruver-la.png` (2096×1127, fondo transparente). **No se modifica,
  no se redibuja ni se recolorea.** Si cambia, se reemplaza este archivo y se ejecuta
  `node scripts/logo.js`.
- Versiones (generadas al doble del tamaño en pantalla, para celulares):

| Archivo | Tamaño | Se muestra a | Uso |
|---|---|---|---|
| `logo-login.png` | 440×237 | 220 px (180 px en celular) | Login, pantallas de carga — clase `.fr-logo.fr-logo-login` |
| `logo-navbar.png` | 200×108 | 100 px | Barra de navegación — clase `.fr-logo.fr-logo-navbar` |
| `favicon-32.png` | 32×32 | — | Ícono de la pestaña |
| `favicon-180.png` | 180×180 | — | Ícono al guardar en la pantalla del celular |

- Tiene un borde blanco fino: ponerlo **siempre sobre fondos claros o tarjetas blancas**.
- Siempre con `alt="Fruver L&A — Calidad y Servicio"` y `width`/`height` para que la página no salte al cargar.

## Login

Fondo con manchas difusas lima y amarilla (`.fr-login`) y círculos casi transparentes en los
bordes. Tarjeta blanca (`.fr-login-card`) con la franja de degradado arriba, logo, etiqueta
"Panel privado", título "Bienvenida" en Georgia y subtítulo gris.

## Reglas

1. **Seguridad (obligatorio)**: los datos de la API se pintan con `.text()`, `.val()` o
   `html\`...\`` + `setHtml` (de `common.js`). Nunca `.html(texto)`, `.append(texto)` ni
   `innerHTML` con datos: permitiría ejecutar código malicioso (XSS). Las pruebas lo verifican.
2. Sin scripts en línea ni `onclick=`: todo evento se registra en el `.js` de la página
   (`$('#boton').on('click', ...)`). La CSP los bloquea.
3. Sin CDN: toda librería se instala con npm y se agrega a `VENDOR_FILES` en `scripts/copy-vendor.js`.
4. Responsive: probar a 375 px (celular) y a 1280 px (computador). Las tablas van dentro de
   `.table-responsive`.
5. Textos visibles, variables y comentarios en español.
