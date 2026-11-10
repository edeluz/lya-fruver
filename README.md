# L&A Fruver

App web de L&A Fruver: formulario de pedidos para clientes y panel de administración
(pedidos, catálogo, proveedores, compras, facturación, clientes y reportes).

Corre en un VPS propio (Hostinger, administrado con **Easypanel**): **Node.js + Express** sirve
las páginas y la API, y la base de datos es **MariaDB 11** (esquema `fruver_lya`).

> **Estado: fase 2 en curso.** Supabase ya se quitó. La API propia contra MariaDB ya existe
> (`server/api.js` y `server/endpoints/`), pero las pantallas (`admin.js`, `cliente.js`) todavía
> no la usan: hay que cambiarlas para que llamen a la API. El ingreso usa usuarios sintéticos
> (ver "Usuarios de prueba") hasta la fase 3.

## Estructura

```
public/              Lo que ve el navegador
  login.html         Ingreso de administración (primera pantalla al abrir la app, "/")
  index.html         Portada (enlaces al formulario y al panel)
  cliente.html       Formulario de pedidos (abierto, sin contraseña)
  admin.html         Panel de administración (exige haber ingresado)
  js/common.js       Utilidades: HTML seguro (anti-XSS) y fechas
  js/login.js        Lógica del ingreso
  js/cliente.js      Lógica del formulario
  js/admin.js        Lógica del panel (exige haber ingresado)
  css/fonts.css      Fuentes Poppins e Inter (servidas localmente)
  vendor/, fonts/    Librerías y fuentes copiadas por "npm run build" (no van en git)
server/              Servidor Express
  index.js           Arranque y apagado ordenado
  app.js             Cabeceras de seguridad, páginas, API y manejo de errores
  config.js          Configuración leída de variables de entorno (sin secretos)
  auth.js            Ingreso, sesiones y protección del panel
  usuarios-prueba.js TEMPORAL: usuarios sintéticos para probar el ingreso
  db.js              Conexión a MariaDB (mysql2) y transacciones
  api.js             Junta las rutas de la API, límite de peticiones y errores
  endpoints/         Un archivo por unidad de negocio
    comun.js         Piezas compartidas (validación, paginación, permisos, fechas)
    proveedores.js, productos.js, clientes.js, pedidos.js, facturas.js
scripts/
  setup-secrets.sh   Crea el archivo .env en el servidor (pide datos con entrada oculta)
  copy-vendor.js     Copia librerías y fuentes a public/
  sql/               Scripts de la base de datos (ver "Base de datos")
  xlsx/              Excel de proveedores (origen de sql/03-proveedores.sql)
test/                Pruebas automáticas
Dockerfile           Imagen de la app (multi-etapa, usuario sin privilegios)
docker-compose.yml   Alternativa sin Easypanel: app + caddy (HTTPS)
Caddyfile, caddy/    Configuración de Caddy (solo para docker-compose)
legacy/              Los HTML originales, sin cambios (respaldo)
```

## Uso en tu computador (desarrollo)

Necesitas Node.js 24 o superior, instalado con **nvm** (en Windows: nvm for Windows).

### Preparar Node con nvm (Windows, una sola vez)

1. Si tienes Node instalado con el instalador oficial, **desinstálalo**: Configuración →
   Aplicaciones → Aplicaciones instaladas → "Node.js" → Desinstalar. Si después queda la carpeta
   `C:\Program Files\nodejs`, bórrala. Ese Node necesita permisos de administrador para
   `npm install -g` y le gana a nvm en el PATH.
2. Cierra todas las terminales y VS Code, y vuelve a abrirlos.
3. Instala Node 24 con nvm y actívalo:
   ```powershell
   nvm install 24
   nvm use 24
   node -v
   npm -v
   ```
4. Actualiza npm (ya no pide administrador, porque nvm guarda todo en tu carpeta de usuario):
   ```powershell
   npm install -g npm
   ```

Si algo falla, `nvm doctor` muestra qué está mal configurado.

### Instalar y arrancar la app

Todos los comandos se ejecutan dentro de la carpeta del proyecto.

1. **Instalar las dependencias** (Express, helmet, `mysql2` para la base de datos, `zod` para
   validar datos, y las librerías de las pantallas). Una vez, y cada vez que cambie
   `package.json`:
   ```bash
   npm install
   ```
   Si alguna vez hay que agregarlas a mano: `npm install mysql2 zod`.

2. **Copiar librerías y fuentes a `public/`** (`public/vendor/` y `public/fonts/`). Sin este
   paso las pantallas se ven sin fuentes y sin gráficas. Una vez después de `npm install`:
   ```bash
   npm run build
   ```

3. **Crear tu `.env` local** (solo en tu computador; nunca se sube a git). Copia
   `.env.example` como `.env` y escribe los datos de conexión **en tu editor**, nunca en un chat:
   ```
   DB_HOST=...        DB_PORT=3306        DB_USER=...
   DB_PASSWORD=...    DB_NAME=fruver_lya  DB_SSL=no
   ```
   Sin `.env` la app arranca igual, pero la API responde 503 ("base de datos no configurada").

4. **Arrancar**:
   ```bash
   npm start         # abre http://localhost:3000 (lee .env si existe)
   npm run dev       # igual, pero se reinicia sola al guardar un archivo
   ```
   Comprueba la conexión abriendo http://localhost:3000/api/health: debe decir
   `"baseDeDatos":"ok"`.

5. **Revisar** (opcional, recomendado antes de subir cambios):
   ```bash
   npm test          # pruebas (las de navegador usan Chrome o Edge si están instalados)
   npm run audit     # revisa vulnerabilidades altas y críticas de las librerías
   ```

Las pruebas de navegador **no tocan los datos reales**: usan datos falsos. Las del formulario
y el panel quedan saltadas ("pendiente: API") hasta que las pantallas usen la API.

### Usuarios de prueba (ingreso)

Al abrir http://localhost:3000 aparece el ingreso. Mientras no exista la tabla de usuarios
(fase 3), se puede entrar con estos usuarios **sintéticos** (inventados, dominio `.test`),
definidos en `server/usuarios-prueba.js`:

| Correo                    | Contraseña             | Resultado                     |
|---------------------------|------------------------|-------------------------------|
| `admin@lyafruver.test`    | `Admin-Prueba-2026`    | Entra al panel                |
| `operario@lyafruver.test` | `Operario-Prueba-2026` | Entra al panel                |
| `inactivo@lyafruver.test` | `Inactivo-Prueba-2026` | No entra (usuario desactivado) |

- En tu computador siempre están activos. En el VPS (producción) están **apagados**, salvo que
  la variable `USUARIOS_PRUEBA` sea `si`. Como sus contraseñas son públicas, apágalos (bórrala o
  pon `no`) cuando termines de probar.
- Tras 5 intentos fallidos desde la misma IP, el ingreso se bloquea 15 minutos.
- Las sesiones duran 8 horas y se guardan en memoria: al reiniciar el servidor hay que
  volver a ingresar.

## API

Todas las direcciones empiezan por `/api`, responden JSON y exigen haber ingresado. Las que
escriben (POST, PUT, PATCH, DELETE) exigen además el rol `admin`. Las listas son paginadas:
`?pagina=1&limite=50` (máximo 200) y responden `{ datos, total, pagina, limite }`. El detalle de
cada filtro está al inicio de cada archivo en `server/endpoints/`.

| Unidad | Direcciones | Qué hace "borrar" (DELETE) |
|---|---|---|
| Estado | `GET /api/health` (sin ingreso) | — |
| Proveedores | `GET /api/proveedores`, `GET/PUT/PATCH/DELETE /api/proveedores/:id`, `POST /api/proveedores` | Inhabilita (`activo = 0`) |
| Clientes | `GET /api/clientes`, `GET/PUT/PATCH/DELETE /api/clientes/:id`, `POST /api/clientes` | Inhabilita (`activo = 0`) |
| Productos | `GET /api/productos`, `GET/PUT/PATCH/DELETE /api/productos/:id`, `POST /api/productos`, `PUT /api/productos/:id/proveedores` | Marca como no disponible |
| Pedidos | `GET /api/pedidos`, `GET/PUT/PATCH/DELETE /api/pedidos/:id`, `POST /api/pedidos` | Borra el pedido y sus productos (no si ya tiene factura) |
| Facturas | `GET /api/facturas`, `GET/PUT/PATCH /api/facturas/:id`, `POST /api/facturas` | No se permite (405) |

- Pedidos y facturas guardan el encabezado y sus productos en una **transacción**: o se guarda
  todo o nada.
- Las facturas calculan subtotales y total en el servidor; si no se envía `fecha`, se usa la de
  hoy en Colombia.
- Códigos: 400 datos no válidos, 401 sin ingreso, 403 sin permiso, 404 no existe, 409 nombre
  repetido o conflicto, 413 cuerpo muy grande, 429 demasiadas peticiones, 503 sin base de datos.

## Base de datos

MariaDB 11, esquema `fruver_lya`. Los scripts están en `scripts/sql/` y se ejecutan en orden
desde la consola de la base (Easypanel → servicio de la base → **Consola**, `mariadb -u root -p`):

| Script | Qué hace | ¿Modifica datos? |
|---|---|---|
| `00-inspeccion.sql` | Muestra tablas, columnas, relaciones y triggers | No (solo lectura) |
| `01-esquema.sql` | Crea la base y las 8 tablas | Sí (solo la primera vez) |
| `02-datos-iniciales.sql` | Catálogo inicial de productos | Sí |
| `03-proveedores.sql` | Proveedores y qué productos surte cada uno (del Excel) | Sí |
| `database.sql` | Esquema original de Supabase (solo referencia, no ejecutar) | — |

**Usuario de la app (nunca `root`).** Ejecútalo una vez como root, escribiendo la contraseña
nueva **directamente en la consola** (no la guardes en ningún archivo del proyecto):

```sql
CREATE USER 'fruver_app'@'%' IDENTIFIED BY 'ESCRIBE-AQUI-UNA-CONTRASEÑA-LARGA';
GRANT SELECT, INSERT, UPDATE ON fruver_lya.* TO 'fruver_app'@'%';
-- DELETE solo donde la API lo necesita: borrar pedidos y reemplazar productos de pedidos,
-- facturas y relaciones producto-proveedor.
GRANT DELETE ON fruver_lya.pedidos              TO 'fruver_app'@'%';
GRANT DELETE ON fruver_lya.pedido_items         TO 'fruver_app'@'%';
GRANT DELETE ON fruver_lya.factura_items        TO 'fruver_app'@'%';
GRANT DELETE ON fruver_lya.producto_proveedores TO 'fruver_app'@'%';
```

Ese usuario no puede tocar el esquema `chatbot-db` (de otro proyecto) ni crear o borrar tablas.

**El puerto 3306 no debe estar abierto a internet.** La app se conecta por la red interna de
Easypanel. Si el servicio de la base tiene un puerto publicado, quítalo en Easypanel o bloquéalo
en el VPS (`sudo ufw deny 3306`). Ojo: un puerto publicado por Docker se salta `ufw`, así que lo
seguro es no publicarlo.

## Despliegue en el VPS con Easypanel

La app es un servicio tipo **App** en Easypanel (proyecto `chatbot`, servicio
`lya-fruver-express`) que se construye con el `Dockerfile` del repositorio. Easypanel pone el
HTTPS (Traefik), así que **Caddy y `docker-compose.yml` no se usan** aquí.

### Primera vez

1. **Base de datos**: en el servicio de MariaDB, ejecuta los scripts de `scripts/sql/` en orden
   y crea el usuario `fruver_app` (ver "Base de datos").
2. **Fuente (Source)**: en el servicio de la app → **Source** → GitHub, con el repositorio y la
   rama `main`. Si el repositorio es privado, Easypanel necesita un token de GitHub.
3. **Construcción (Build)**: tipo **Dockerfile**, ruta `Dockerfile`. El Dockerfile ya ejecuta
   `npm ci` y `npm run build` por dentro; no hay que hacerlo a mano en el servidor.
4. **Variables de entorno (Environment)**: escríbelas sin comillas. Los valores secretos se
   escriben solo ahí, nunca en el repositorio:
   ```
   PORT=3000
   DB_HOST=<nombre interno del servicio MariaDB en Easypanel>
   DB_PORT=3306
   DB_USER=fruver_app
   DB_PASSWORD=<la contraseña de fruver_app>
   DB_NAME=fruver_lya
   DB_SSL=no
   USUARIOS_PRUEBA=no
   ```
   `NODE_ENV=production` ya viene en el Dockerfile. `DB_HOST` es el nombre interno del servicio
   (lo muestra Easypanel en el servicio de la base), no la IP pública.
5. **Dominio (Domains)**: agrega el dominio, con HTTPS activado, apuntando al puerto **3000**.
   El dominio debe tener un registro DNS tipo **A** con la IP del VPS.
6. Presiona **Deploy** y revisa los **Logs**: deben decir `L&A Fruver escuchando en el puerto 3000`.
7. **Comprueba**: abre `https://TU-DOMINIO/api/health`; debe decir `"baseDeDatos":"ok"`.

### Actualizar después de un cambio

1. En tu computador, revisa que todo funcione (`npm start`, y si quieres `npm test` y
   `npm run audit`).
2. Sube los cambios a GitHub (`git add`, `git commit`, `git push`). Antes del commit revisa que
   ningún archivo tenga contraseñas (`.env` nunca se sube; `.env.example` solo lleva valores falsos).
3. En Easypanel presiona **Deploy** (o activa el despliegue automático al hacer push).
4. Revisa los **Logs** y `https://TU-DOMINIO/api/health`.

Si en los logs aparece `Recibido SIGTERM, cerrando...`, Easypanel detuvo el contenedor (por un
nuevo despliegue o porque falló la revisión de salud). Revisa que `PORT` y el puerto del dominio
sean `3000`.

### Alternativa sin Easypanel (docker compose + Caddy)

En un VPS solo con Docker: `bash scripts/setup-secrets.sh` (crea `.env` con entrada oculta y
permisos 600) y luego `docker compose up -d --build`. Caddy pone el HTTPS. Ningún servicio
interno debe tener `ports:` en `docker-compose.yml`.

## Seguridad

**En la app**
- Todo dato que se muestra en pantalla pasa por la función `html` de `common.js`, que lo
  escapa automáticamente. Un nombre o comentario con código malicioso se ve como texto y no se
  ejecuta. Las pruebas de navegador lo comprueban.
- Cabeceras de seguridad con `helmet`. La política de contenido (CSP) solo permite scripts
  propios (ni externos ni en línea), ninguna página puede incrustar la app y solo se permiten
  conexiones al propio servidor.
- La API usa consultas parametrizadas (sin inyección SQL), valida todo con `zod`, limita las
  peticiones (300 por minuto por IP) y el tamaño del cuerpo (100 KB), y nunca muestra detalles
  internos de un error.
- Las librerías (Excel, gráficas, imagen de factura) y las fuentes se sirven desde el propio
  servidor, sin CDNs.
- No hay CORS habilitado: el navegador solo permite peticiones desde el mismo sitio.

**En los contenedores**
- La app corre **sin root** y su imagen no incluye herramientas de desarrollo.
- Con docker-compose: sin permisos extra (`cap_drop: ALL`), `no-new-privileges`, sistema de
  archivos de solo lectura, y solo Caddy publica puertos.

**Secretos**
- Los datos de conexión van en variables de entorno: en Easypanel (Environment) o en un `.env`
  local. `.env` está excluido de git (`.gitignore`) y de las imágenes Docker (`.dockerignore`).
- `.env.example` solo tiene valores falsos de ejemplo.
- Nunca se usa el usuario `root` de la base en la app.

## Riesgos pendientes

1. **El proyecto de Supabase sigue abierto.** Sus reglas permitían a cualquiera leer y
   modificar las tablas con la llave pública que estuvo en los HTML. Hay que exportar los datos
   y luego pausar o borrar el proyecto.
2. **Las pantallas todavía no usan la API**: el formulario y el panel no leen ni guardan datos
   hasta cambiar `admin.js` y `cliente.js`.
3. El formulario público de clientes no puede crear pedidos sin ingresar: falta una dirección
   pública solo para eso, con límite de peticiones.
4. El ingreso usa usuarios **sintéticos** (contraseñas públicas en este README) y sesiones en
   memoria. Los usuarios reales, con roles, pasan a la base en la fase 3.
5. La API todavía no tiene pruebas automáticas.
6. Aún no hay backups de la base de datos (fase 5).
