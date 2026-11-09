-- ============================================
-- L&A FRUVER - Esquema de la base de datos para MariaDB
-- Requiere MariaDB 10.7 o superior (pensado para MariaDB 11). No sirve en MySQL: el tipo
-- UUID solo existe en MariaDB.
-- Traducido de scripts/sql/database.sql (Supabase/PostgreSQL), con las columnas que allá
-- se agregaron después con ALTER TABLE ya incluidas.
-- Ejecutar ANTES de 02-datos-iniciales.sql.
--
-- Decisiones:
--  - Ids: tipo nativo UUID de MariaDB (16 bytes, valida el formato), igual que en Supabase. El panel no cambia y los ids del
--    formulario público no se pueden adivinar. La API debe generar el id (crypto.randomUUID())
--    para conocerlo al insertar; el DEFAULT es solo para inserciones manuales.
--  - Fechas y horas: DATETIME en UTC (DEFAULT UTC_TIMESTAMP()). La app las convierte a la
--    hora de Colombia al mostrarlas. No se usa TIMESTAMP porque se acaba en el año 2038.
--  - Cantidades y dinero: DECIMAL con tamaño. Un DECIMAL sin tamaño en MariaDB no guarda
--    decimales (1.5 kg quedaría en 2 kg).
--  - No hay "row level security" ni políticas: la seguridad la pone la API del servidor y
--    un usuario de base de datos con permisos solo sobre esta base.
-- ============================================

CREATE DATABASE IF NOT EXISTS fruver_lya
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE fruver_lya;

-- Proveedores
CREATE TABLE proveedores (
  id             UUID         NOT NULL DEFAULT (UUID()),
  nombre         VARCHAR(150) NOT NULL,
  telefono       VARCHAR(30)  NULL,
  direccion      VARCHAR(255) NULL,
  notas          TEXT         NULL,
  activo         BOOLEAN      NOT NULL DEFAULT TRUE,
  creado_en      DATETIME     NOT NULL DEFAULT (UTC_TIMESTAMP()),
  actualizado_en DATETIME     NOT NULL DEFAULT (UTC_TIMESTAMP()),
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Productos (catálogo)
-- Con utf8mb4_unicode_ci, "Limón" y "limon" cuentan como el mismo nombre (evita duplicados).
CREATE TABLE productos (
  id         UUID          NOT NULL DEFAULT (UUID()),
  nombre     VARCHAR(150)  NOT NULL,
  unidad     VARCHAR(20)   NOT NULL DEFAULT 'unidad',
  precio     DECIMAL(14,2) NULL,
  disponible BOOLEAN       NOT NULL DEFAULT TRUE,
  creado_en  DATETIME      NOT NULL DEFAULT (UTC_TIMESTAMP()),
  PRIMARY KEY (id),
  UNIQUE KEY uq_productos_nombre (nombre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Relación producto <-> proveedores que lo surten (varios a varios)
CREATE TABLE producto_proveedores (
  producto_id  UUID     NOT NULL,
  proveedor_id UUID     NOT NULL,
  PRIMARY KEY (producto_id, proveedor_id),
  KEY ix_producto_proveedores_proveedor (proveedor_id),
  CONSTRAINT fk_pp_producto  FOREIGN KEY (producto_id)  REFERENCES productos (id)   ON DELETE CASCADE,
  CONSTRAINT fk_pp_proveedor FOREIGN KEY (proveedor_id) REFERENCES proveedores (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Clientes
CREATE TABLE clientes (
  id             UUID         NOT NULL DEFAULT (UUID()),
  nombre         VARCHAR(150) NOT NULL,
  telefono       VARCHAR(30)  NULL,
  direccion      VARCHAR(255) NULL,
  activo         BOOLEAN      NOT NULL DEFAULT TRUE,
  creado_en      DATETIME     NOT NULL DEFAULT (UTC_TIMESTAMP()),
  actualizado_en DATETIME     NOT NULL DEFAULT (UTC_TIMESTAMP()),
  PRIMARY KEY (id),
  UNIQUE KEY uq_clientes_nombre (nombre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Pedidos (encabezado)
-- Un cliente con pedidos no se puede borrar (igual que en Supabase): se desactiva.
CREATE TABLE pedidos (
  id             UUID                     NOT NULL DEFAULT (UUID()),
  cliente_id     UUID                     NULL,
  cliente_nombre VARCHAR(150)             NOT NULL,  -- respaldo en texto por si el cliente es nuevo
  comentario     TEXT                     NULL,      -- la usa el código; no estaba en el script de Supabase
  origen         ENUM('cliente','admin')  NOT NULL DEFAULT 'cliente',
  creado_en      DATETIME                 NOT NULL DEFAULT (UTC_TIMESTAMP()),
  PRIMARY KEY (id),
  KEY ix_pedidos_creado_en (creado_en),
  CONSTRAINT fk_pedidos_cliente FOREIGN KEY (cliente_id) REFERENCES clientes (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Detalle de cada pedido (uno o varios productos por pedido)
CREATE TABLE pedido_items (
  id              UUID          NOT NULL DEFAULT (UUID()),
  pedido_id       UUID          NOT NULL,
  producto_id     UUID          NULL,
  producto_nombre VARCHAR(150)  NOT NULL,  -- respaldo en texto
  cantidad        DECIMAL(10,3) NOT NULL,
  unidad          VARCHAR(20)   NOT NULL,
  observacion     TEXT          NULL,
  creado_en       DATETIME      NOT NULL DEFAULT (UTC_TIMESTAMP()),
  PRIMARY KEY (id),
  KEY ix_pedido_items_producto (producto_id),
  CONSTRAINT fk_pi_pedido   FOREIGN KEY (pedido_id)   REFERENCES pedidos (id) ON DELETE CASCADE,
  CONSTRAINT fk_pi_producto FOREIGN KEY (producto_id) REFERENCES productos (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Facturas (encabezado)
-- "numero" es el consecutivo visible (#1, #2...). Puede saltarse un número si un guardado
-- falla a mitad; si se necesita numeración sin huecos (por ejemplo, DIAN), hay que manejarlo aparte.
-- "fecha" no tiene valor por defecto: la API debe enviar la fecha de Colombia, porque la del
-- servidor puede ser ya el día siguiente.
CREATE TABLE facturas (
  id                UUID            NOT NULL DEFAULT (UUID()),
  numero            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  cliente_id        UUID            NULL,
  cliente_nombre    VARCHAR(150)    NOT NULL,
  cliente_telefono  VARCHAR(30)     NULL,
  cliente_direccion VARCHAR(255)    NULL,
  pedido_id         UUID            NULL,
  fecha             DATE            NOT NULL,
  flete             DECIMAL(14,2)   NOT NULL DEFAULT 0,
  total             DECIMAL(14,2)   NOT NULL DEFAULT 0,
  creado_en         DATETIME        NOT NULL DEFAULT (UTC_TIMESTAMP()),
  PRIMARY KEY (id),
  UNIQUE KEY uq_facturas_numero (numero),
  KEY ix_facturas_fecha (fecha),
  CONSTRAINT fk_facturas_cliente FOREIGN KEY (cliente_id) REFERENCES clientes (id),
  CONSTRAINT fk_facturas_pedido  FOREIGN KEY (pedido_id)  REFERENCES pedidos (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Detalle de cada factura
CREATE TABLE factura_items (
  id              UUID          NOT NULL DEFAULT (UUID()),
  factura_id      UUID          NOT NULL,
  producto_nombre VARCHAR(150)  NOT NULL,
  cantidad        DECIMAL(10,3) NOT NULL,
  unidad          VARCHAR(20)   NOT NULL,
  precio_unitario DECIMAL(14,2) NOT NULL DEFAULT 0,
  subtotal        DECIMAL(14,2) NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  CONSTRAINT fk_fi_factura FOREIGN KEY (factura_id) REFERENCES facturas (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
