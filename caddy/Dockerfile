# Caddy oficial, pero ejecutándose con un usuario sin privilegios (no root).
FROM caddy:2.10-alpine

# El binario oficial trae un permiso especial para usar los puertos 80/443. Se lo quitamos porque
# el contenedor arranca sin ningún permiso extra (cap_drop: ALL) y, en su lugar, docker-compose
# permite los puertos bajos con el ajuste net.ipv4.ip_unprivileged_port_start=0.
RUN apk add --no-cache libcap-utils \
 && setcap -r /usr/bin/caddy \
 && apk del libcap-utils \
 && addgroup -S -g 10001 caddy \
 && adduser -S -D -H -u 10001 -G caddy caddy \
 && mkdir -p /data /config \
 && chown -R caddy:caddy /data /config

USER caddy
