#!/usr/bin/env bash
# Crea o actualiza el archivo .env del servidor.
#  - Pide los datos en la terminal.
#  - Genera solos los secretos aleatorios (SESSION_SECRET y MYSQL_PASSWORD).
#  - Guarda .env con permisos 600 (solo tu usuario puede leerlo).
#  - Nunca muestra secretos en pantalla.
#  - Si lo vuelves a ejecutar, conserva lo que ya existe y solo cambia lo que tú elijas.
#
# Uso (en el VPS, dentro de la carpeta del proyecto):
#   bash scripts/setup-secrets.sh
set -euo pipefail
umask 077

cd "$(dirname "$0")/.."
ENV_FILE=".env"
DEFAULT_DOMAIN="pedidos.layfruver.com"

say() { printf '%s\n' "$*"; }
fail() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

# ---------- Comprobaciones ----------
command -v docker >/dev/null 2>&1 || fail "Docker no está instalado."
docker info >/dev/null 2>&1 || fail "Tu usuario no puede usar Docker. Agrégalo al grupo docker o pide ayuda."

if [ -d .git ] && command -v git >/dev/null 2>&1; then
  git check-ignore -q "$ENV_FILE" || fail ".env NO está en .gitignore. No continúo para no filtrar secretos."
fi

touch "$ENV_FILE"
chmod 600 "$ENV_FILE"

# ---------- Lectura y escritura de .env (sin mostrar valores) ----------
get_value() {
  local line
  line=$(grep -E "^$1=" "$ENV_FILE" | tail -n 1 || true)
  line=${line#*=}
  line=${line#\'}
  line=${line%\'}
  printf '%s' "$line"
}

set_value() {
  local key=$1 value=$2 tmp
  case "$value" in *"'"*|*$'\n'*) fail "El valor de $key no puede contener comillas simples ni saltos de línea." ;; esac
  tmp=$(mktemp "${ENV_FILE}.XXXXXX")
  grep -vE "^${key}=" "$ENV_FILE" > "$tmp" || true
  printf "%s='%s'\n" "$key" "$value" >> "$tmp"
  chmod 600 "$tmp"
  mv "$tmp" "$ENV_FILE"
}

# Pregunta un dato visible (no secreto), con valor por defecto y validación.
ask() {
  local key=$1 question=$2 default=$3 pattern=$4 current answer
  current=$(get_value "$key")
  [ -n "$current" ] && default=$current
  while true; do
    read -rp "$question [$default]: " answer
    answer=${answer:-$default}
    if [[ "$answer" =~ $pattern ]]; then
      set_value "$key" "$answer"
      return
    fi
    say "  Valor no válido, inténtalo de nuevo."
  done
}

random_secret() {
  head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n'
}

# ---------- Datos visibles ----------
say ""
say "=== Configuración de L&A Fruver ==="
say "Presiona Enter para aceptar el valor entre corchetes."
say ""
ask DOMAIN     "Dominio de la app"                    "$DEFAULT_DOMAIN" '^[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
ask ACME_EMAIL "Correo para avisos del certificado"   "correo@ejemplo.com" '^[^@[:space:]]+@[^@[:space:]]+\.[A-Za-z]{2,}$'

# ---------- Secretos generados automáticamente (solo si no existen) ----------
for key in SESSION_SECRET MYSQL_PASSWORD; do
  if [ -z "$(get_value "$key")" ]; then
    set_value "$key" "$(random_secret)"
  fi
done

chmod 600 "$ENV_FILE"
say ""
say "Listo. Archivo .env guardado con permisos 600 (solo tu usuario puede leerlo)."
say "Datos configurados: DOMAIN, ACME_EMAIL, SESSION_SECRET, MYSQL_PASSWORD."
say "Por seguridad no se muestra ningún valor secreto."
