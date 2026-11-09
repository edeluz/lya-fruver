# L&A Fruver

App web de L&A Fruver: formulario de pedidos para clientes y panel de administración
(pedidos, catálogo, proveedores, compras, facturación, clientes y reportes).

Corre en un VPS propio con Docker: **Node.js + Express** sirve las páginas y **Caddy**
pone HTTPS automático.

> **Estado: pasando a la fase 2.** Las páginas se sirven desde el servidor propio. Supabase
> **ya se quitó**, pero la base de datos propia (**MySQL**) y su API todavía no existen: por
> ahora el formulario de pedidos y el panel **no pueden leer ni guardar datos**. El login con
> roles llega en la fase 3. Mientras tanto, el panel tiene una contraseña temporal en Caddy.

## Estructura

```
public/              Lo que ve el navegador
  index.html         Portada
  cliente.html       Formulario de pedidos (abierto, sin contraseña)
  admin.html         Panel de administración (protegido con contraseña)
  js/common.js       Utilidades: HTML seguro (anti-XSS) y fechas
  js/cliente.js      Lógica del formulario
  js/admin.js        Lógica del panel
  css/fonts.css      Fuentes Poppins e Inter (servidas localmente)
  vendor/, fonts/    Librerías y fuentes copiadas por "npm run build" (no van en git)
server/              Servidor Express (solo entrega las páginas por ahora)
scripts/
  setup-secrets.sh   Crea el archivo .env en el servidor (pide datos con entrada oculta)
  copy-vendor.js     Copia librerías y fuentes a public/
test/                Pruebas automáticas
caddy/Dockerfile     Caddy ejecutándose sin root
Caddyfile            Configuración de HTTPS y de la contraseña del panel
Dockerfile           Imagen de la app (multi-etapa, usuario sin privilegios)
docker-compose.yml   Une app + caddy
tables.sql           Esquema que se usaba en Supabase (referencia para el esquema MySQL)
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

```bash
npm install       # instala dependencias
npm run build     # copia librerías y fuentes a public/
npm start         # abre http://localhost:3000
npm test          # pruebas (las de navegador usan Chrome o Edge si están instalados)
npm run audit     # revisa vulnerabilidades altas y críticas
```

Las pruebas de navegador **no tocan los datos reales**: usan datos falsos. Las del formulario
y el panel quedan saltadas ("pendiente: API con MySQL") hasta que exista la API.

## Despliegue en el VPS (resumen)

La guía detallada se hace paso a paso, un comando a la vez. Orden general:

1. **Asegurar el servidor**: usuario sin root con llave SSH, SSH sin contraseña ni root,
   firewall `ufw` (solo 22, 80 y 443), `fail2ban` y actualizaciones automáticas de seguridad.
2. **Apuntar el dominio**: un registro DNS tipo **A** con la IP del VPS. Sin esto, Caddy
   no puede obtener el certificado HTTPS.
3. **Subir el proyecto** desde tu computador (PowerShell, dentro de la carpeta del proyecto):
   ```powershell
   tar -czf ..\lya-fruver.tgz --exclude=node_modules --exclude=.env --exclude=public/vendor --exclude=public/fonts --exclude=legacy .
   scp ..\lya-fruver.tgz USUARIO@IP_DEL_VPS:~/
   ```
   En el VPS:
   ```bash
   mkdir -p ~/lya-fruver && tar -xzf ~/lya-fruver.tgz -C ~/lya-fruver && cd ~/lya-fruver
   ```
4. **Crear los secretos** (en el VPS, en tu propia terminal SSH, nunca en un chat):
   ```bash
   bash scripts/setup-secrets.sh
   ```
5. **Arrancar**:
   ```bash
   docker compose up -d --build
   docker compose ps          # ambos servicios deben decir "running" / "healthy"
   docker compose logs caddy  # revisar que obtuvo el certificado
   ```
6. **Actualizar** después de un cambio: repetir el paso 3 y luego `docker compose up -d --build`.

## Seguridad

**En la app (fase 1)**
- Todo dato que se muestra en pantalla pasa por la función `html` de `common.js`, que lo
  escapa automáticamente. Un nombre o comentario con código malicioso se ve como texto y no se
  ejecuta. Las pruebas de navegador lo comprueban.
- Cabeceras de seguridad con `helmet`. La política de contenido (CSP) solo permite scripts
  propios (ni externos ni en línea), ninguna página puede incrustar la app y solo se permiten
  conexiones al propio servidor.
- Las librerías (Excel, gráficas, imagen de factura) y las fuentes se sirven desde el propio
  servidor, sin CDNs.
- Los errores no muestran detalles internos al visitante.
- No hay CORS habilitado: el navegador solo permite peticiones desde el mismo sitio.

**En los contenedores**
- La app y Caddy corren **sin root**, sin permisos extra (`cap_drop: ALL`),
  `no-new-privileges`, sistema de archivos de solo lectura y `restart: unless-stopped`.
- La app no tiene puertos abiertos al exterior: solo Caddy (80/443) la alcanza, por la red
  interna de Docker.
- **Importante:** Docker abre sus puertos por fuera de `ufw`. Por eso ningún servicio
  interno (ni la futura base de datos) debe tener `ports:` en `docker-compose.yml`.

**Secretos**
- El `.env` real lo crea `scripts/setup-secrets.sh` en el servidor, con permisos 600. Está
  excluido de git (`.gitignore`) y de las imágenes Docker (`.dockerignore`).
- `SESSION_SECRET` y `MYSQL_PASSWORD` se generan al azar; nadie tiene que inventarlos.
- `.env.example` solo tiene valores falsos de ejemplo.

## Riesgos pendientes (se resuelven en las próximas fases)

1. **El proyecto de Supabase sigue abierto.** Aunque las páginas ya no lo usan, las reglas de
   `tables.sql` permiten a cualquiera leer y modificar todas las tablas con la llave pública
   que estuvo en los HTML. Hay que exportar los datos (para pasarlos a MySQL) y luego pausar
   o borrar el proyecto en Supabase.
2. **La app no tiene datos** hasta que existan la base MySQL y la API del servidor (fase 2).
3. La contraseña temporal del panel (Caddy) no limita los intentos fallidos. El login propio
   de la fase 3 sí los limitará.
4. La lista de clientes del formulario es pública, y un cliente nuevo con un nombre repetido
   queda unido al cliente existente (fases 2 y 3).
5. Un pedido o una factura pueden quedar a medias si falla la conexión mientras se guardan
   (fase 2, con transacciones en el servidor).
6. Aún no hay backups: llegan con la base de datos propia (fases 2 y 5).
