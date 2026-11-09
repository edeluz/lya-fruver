# syntax=docker/dockerfile:1

# ---------- Etapa 1: preparar (instala todo y copia librerías/fuentes) ----------
FROM node:24-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund

COPY scripts/copy-vendor.js scripts/
COPY public/ public/
RUN npm run build \
 && npm prune --omit=dev --ignore-scripts

# ---------- Etapa 2: imagen final, pequeña y sin herramientas de desarrollo ----------
FROM node:24-alpine AS runtime
ENV NODE_ENV=production \
    PORT=3000
WORKDIR /app

# Los archivos quedan de root y solo lectura para la app: el usuario "node" no puede modificarlos.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/public ./public
COPY package.json ./
COPY server/ ./server/

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server/index.js"]
