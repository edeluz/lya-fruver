-- ============================================
-- L&A FRUVER - Inspección de la base (SOLO LECTURA)
-- No crea, no cambia y no borra nada. No muestra contraseñas ni datos de clientes:
-- solo la estructura (tablas, columnas, relaciones, triggers) y cuántas filas hay.
-- Solo mira el esquema fruver_lya (no toca chatbot-db).
-- ============================================

-- 1. Motor y versión, y si acepta conexiones cifradas (TLS)
SELECT VERSION() AS version;
SHOW GLOBAL VARIABLES WHERE Variable_name IN
  ('have_ssl', 'require_secure_transport', 'tls_version', 'bind_address', 'port', 'time_zone', 'system_time_zone');

-- 2. Tablas y cuántas filas tiene cada una
SELECT 'clientes' AS tabla, COUNT(*) AS filas FROM fruver_lya.clientes
UNION ALL SELECT 'facturas', COUNT(*) FROM fruver_lya.facturas
UNION ALL SELECT 'factura_items', COUNT(*) FROM fruver_lya.factura_items
UNION ALL SELECT 'pedidos', COUNT(*) FROM fruver_lya.pedidos
UNION ALL SELECT 'pedido_items', COUNT(*) FROM fruver_lya.pedido_items
UNION ALL SELECT 'productos', COUNT(*) FROM fruver_lya.productos
UNION ALL SELECT 'proveedores', COUNT(*) FROM fruver_lya.proveedores
UNION ALL SELECT 'producto_proveedores', COUNT(*) FROM fruver_lya.producto_proveedores;

SELECT TABLE_NAME AS tabla, ENGINE AS motor, TABLE_COLLATION AS intercalacion
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = 'fruver_lya'
ORDER BY TABLE_NAME;

-- 3. Columnas de cada tabla
SELECT TABLE_NAME AS tabla, COLUMN_NAME AS columna, COLUMN_TYPE AS tipo,
       IS_NULLABLE AS acepta_nulo, COLUMN_DEFAULT AS por_defecto, COLUMN_KEY AS llave, EXTRA AS extra
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'fruver_lya'
ORDER BY TABLE_NAME, ORDINAL_POSITION;

-- 4. Llaves foráneas (relaciones) y qué pasa al borrar
SELECT k.TABLE_NAME AS tabla, k.COLUMN_NAME AS columna,
       k.REFERENCED_TABLE_NAME AS apunta_a, k.REFERENCED_COLUMN_NAME AS columna_destino,
       r.DELETE_RULE AS al_borrar, r.UPDATE_RULE AS al_actualizar
FROM information_schema.KEY_COLUMN_USAGE k
JOIN information_schema.REFERENTIAL_CONSTRAINTS r
  ON r.CONSTRAINT_SCHEMA = k.CONSTRAINT_SCHEMA AND r.CONSTRAINT_NAME = k.CONSTRAINT_NAME
WHERE k.TABLE_SCHEMA = 'fruver_lya' AND k.REFERENCED_TABLE_NAME IS NOT NULL
ORDER BY k.TABLE_NAME, k.COLUMN_NAME;

-- 5. Índices (únicos y normales)
SELECT TABLE_NAME AS tabla, INDEX_NAME AS indice, NON_UNIQUE AS no_unico,
       GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) AS columnas
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = 'fruver_lya'
GROUP BY TABLE_NAME, INDEX_NAME, NON_UNIQUE
ORDER BY TABLE_NAME, INDEX_NAME;

-- 6. Triggers (para saber si la base genera los UUID o las fechas sola)
SELECT EVENT_OBJECT_TABLE AS tabla, TRIGGER_NAME AS trigger_nombre,
       ACTION_TIMING AS cuando, EVENT_MANIPULATION AS evento, ACTION_STATEMENT AS que_hace
FROM information_schema.TRIGGERS
WHERE TRIGGER_SCHEMA = 'fruver_lya'
ORDER BY EVENT_OBJECT_TABLE;

-- 7. Usuarios de la base que ya existen (solo nombre y desde dónde se conectan, sin contraseñas)
SELECT User AS usuario, Host AS desde FROM mysql.user ORDER BY User;
