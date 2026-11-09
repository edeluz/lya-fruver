-- ============================================
-- L&A FRUVER - Proveedores y qué productos surte cada uno
-- Generado desde scripts/xlsx/ProveedoresFruverL&A.xlsx (hoja "Proveedores").
-- Ejecutar DESPUÉS de 01-esquema.sql y 02-datos-iniciales.sql.
-- Se puede volver a ejecutar sin duplicar nada.
--
-- Contenido: 25 proveedores, 108 productos nuevos para el catálogo
-- y 180 relaciones proveedor -> producto (164 productos distintos:
-- 56 ya estaban en el catálogo).
--
-- REVISAR después de ejecutar:
--  - Los productos nuevos quedan con unidad 'unidad', sin precio y disponibles en el
--    formulario de pedidos. Ajusta la unidad y el precio en el panel (Catálogo).
--  - Algunos productos nuevos pueden ser el mismo de otro ya existente escrito distinto
--    (p. ej. "Tomate árbol" y "Tomate de árbol"). Se crearon tal cual el Excel.
--  - Los proveedores no traen teléfono ni dirección.
-- ============================================

USE fruver_lya;

START TRANSACTION;

-- 1. Proveedores (25). "nombre" no es único en la tabla, por eso se revisa antes.
INSERT INTO proveedores (nombre) SELECT 'Juan Zuluaga' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM proveedores WHERE nombre = 'Juan Zuluaga');
INSERT INTO proveedores (nombre) SELECT 'Depósito Yired' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM proveedores WHERE nombre = 'Depósito Yired');
INSERT INTO proveedores (nombre) SELECT 'Ovirne Andrés' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM proveedores WHERE nombre = 'Ovirne Andrés');
INSERT INTO proveedores (nombre) SELECT 'Sebastián Querubín' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM proveedores WHERE nombre = 'Sebastián Querubín');
INSERT INTO proveedores (nombre) SELECT 'La Costeña' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM proveedores WHERE nombre = 'La Costeña');
INSERT INTO proveedores (nombre) SELECT 'Ever Fresa Malvinas' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM proveedores WHERE nombre = 'Ever Fresa Malvinas');
INSERT INTO proveedores (nombre) SELECT 'Fredy López' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM proveedores WHERE nombre = 'Fredy López');
INSERT INTO proveedores (nombre) SELECT 'Cindy Lorena' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM proveedores WHERE nombre = 'Cindy Lorena');
INSERT INTO proveedores (nombre) SELECT 'Diana La Mona' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM proveedores WHERE nombre = 'Diana La Mona');
INSERT INTO proveedores (nombre) SELECT 'Eliana La Rojita' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM proveedores WHERE nombre = 'Eliana La Rojita');
INSERT INTO proveedores (nombre) SELECT 'Cereté' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM proveedores WHERE nombre = 'Cereté');
INSERT INTO proveedores (nombre) SELECT 'Pipe Palacio' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM proveedores WHERE nombre = 'Pipe Palacio');
INSERT INTO proveedores (nombre) SELECT 'Andrés Hincapié' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM proveedores WHERE nombre = 'Andrés Hincapié');
INSERT INTO proveedores (nombre) SELECT 'Ferney WF' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM proveedores WHERE nombre = 'Ferney WF');
INSERT INTO proveedores (nombre) SELECT 'Sebastián Castaño' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM proveedores WHERE nombre = 'Sebastián Castaño');
INSERT INTO proveedores (nombre) SELECT 'Frutas López' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM proveedores WHERE nombre = 'Frutas López');
INSERT INTO proveedores (nombre) SELECT 'LyA Maracuyá' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM proveedores WHERE nombre = 'LyA Maracuyá');
INSERT INTO proveedores (nombre) SELECT 'Milton' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM proveedores WHERE nombre = 'Milton');
INSERT INTO proveedores (nombre) SELECT 'Jovani 15' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM proveedores WHERE nombre = 'Jovani 15');
INSERT INTO proveedores (nombre) SELECT 'Fernando Ramas Malvinas' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM proveedores WHERE nombre = 'Fernando Ramas Malvinas');
INSERT INTO proveedores (nombre) SELECT 'Fabio Comino Malvinas' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM proveedores WHERE nombre = 'Fabio Comino Malvinas');
INSERT INTO proveedores (nombre) SELECT 'Depósito El Socio' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM proveedores WHERE nombre = 'Depósito El Socio');
INSERT INTO proveedores (nombre) SELECT 'Embandejados Mayey' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM proveedores WHERE nombre = 'Embandejados Mayey');
INSERT INTO proveedores (nombre) SELECT 'Otros' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM proveedores WHERE nombre = 'Otros');
INSERT INTO proveedores (nombre) SELECT 'Agrofrutos' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM proveedores WHERE nombre = 'Agrofrutos');

-- 2. Productos nuevos para el catálogo (108). Si ya existe uno con el mismo nombre, no se toca.
INSERT INTO productos (nombre) VALUES
('Agraz'),
('Aguacate hass maduro'),
('Aguacate hass pintón'),
('Aguacate hass verde'),
('Ahuyamín'),
('Ají dulce rojo'),
('Ají dulce verde'),
('Ají rocoto'),
('Arándanos libra'),
('Arveja desgranada'),
('Banano maduro'),
('Banano pintón'),
('Banano verde'),
('Batata'),
('Borojó'),
('Bulbo de hinojo'),
('Calabacín'),
('Carambolo'),
('Cebolla larga'),
('Cebolla puerro'),
('Cebollín'),
('Champiñón parís'),
('Cherry'),
('Choquet'),
('Cimarrón'),
('Ciruela claudia'),
('Cogollo'),
('Col china'),
('Coles'),
('Comino maduro'),
('Comino pintón'),
('Comino verde'),
('Crimini'),
('Criolla balín'),
('Curuba larga'),
('Durazno nectarin'),
('Echalote'),
('Espinaca bogotona'),
('Espinaca común'),
('Estrago'),
('Estragón'),
('Fresa 2da'),
('Fresa jumbo'),
('Frijol'),
('Guanábana'),
('Guayaba feijoa'),
('Guayaba manzana'),
('Guayaba pera'),
('Guineo'),
('Guisantes'),
('Gulupa'),
('Habichuelina'),
('Higos'),
('Jengibre'),
('Kale bandeja'),
('Kale kilo'),
('Laurel'),
('Lechuga hidropónica'),
('Lechuga morada'),
('Limón tahity'),
('Mango azúcar'),
('Mango maduro'),
('Mango pintón'),
('Mango tomy'),
('Mangostino'),
('Manzana gala'),
('Manzanilla'),
('Maracuyá'),
('Menta'),
('Mix'),
('Murrapo'),
('Ñame'),
('Orégano'),
('Orellana'),
('Papa capira tronco'),
('Papa criolla balín'),
('Papayuelas'),
('Papelillo maduro'),
('Papelillo pintón'),
('Papelillo verde'),
('Pepino'),
('Pepino de rellenar'),
('Pepino europeo'),
('Pera'),
('Perejil crespo'),
('Perlita'),
('Pimentón amarillo'),
('Pimentón verde'),
('Piña'),
('Plátano negro'),
('Portobello'),
('Rábano'),
('Raíz china'),
('Romero'),
('Rúgula bandeja'),
('Sukini'),
('Tamarindo'),
('Tangelo'),
('Tomate árbol'),
('Tomate extra pintón'),
('Tomate extra rojo'),
('Tomate riñón'),
('Tomatillo'),
('Tomillo'),
('Toronja'),
('Uva roja bandeja'),
('Uvalina'),
('Yacón')
ON DUPLICATE KEY UPDATE nombre = nombre;

-- 3. Relaciones proveedor -> producto (180).
-- Se cargan en una tabla temporal y se unen por nombre (sin distinguir mayúsculas ni tildes).
CREATE TEMPORARY TABLE tmp_proveedor_producto (
  proveedor VARCHAR(150) NOT NULL,
  producto  VARCHAR(150) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO tmp_proveedor_producto (proveedor, producto) VALUES
('Juan Zuluaga', 'Papa criolla'),
('Juan Zuluaga', 'Papa criolla balín'),
('Juan Zuluaga', 'Zanahoria'),
('Juan Zuluaga', 'Frijol'),
('Juan Zuluaga', 'Arveja'),
('Juan Zuluaga', 'Remolacha'),
('Juan Zuluaga', 'Arracacha'),
('Juan Zuluaga', 'Habichuela'),
('Juan Zuluaga', 'Papa nevada'),
('Depósito Yired', 'Tomate extra rojo'),
('Depósito Yired', 'Tomate extra pintón'),
('Depósito Yired', 'Cebolla blanca'),
('Depósito Yired', 'Cebolla roja'),
('Depósito Yired', 'Pepino cohombro'),
('Depósito Yired', 'Guanábana'),
('Depósito Yired', 'Tomate riñón'),
('Ovirne Andrés', 'Papelillo maduro'),
('Ovirne Andrés', 'Papelillo verde'),
('Ovirne Andrés', 'Papelillo pintón'),
('Ovirne Andrés', 'Choquet'),
('Sebastián Querubín', 'Yuca'),
('La Costeña', 'Pitahaya'),
('La Costeña', 'Mangostino'),
('La Costeña', 'Uva verde sin semilla'),
('La Costeña', 'Uva roja bandeja'),
('La Costeña', 'Agraz'),
('La Costeña', 'Carambolo'),
('La Costeña', 'Ciruela claudia'),
('La Costeña', 'Tamarindo'),
('La Costeña', 'Curuba larga'),
('La Costeña', 'Durazno nectarin'),
('La Costeña', 'Pera verde'),
('La Costeña', 'Borojó'),
('La Costeña', 'Berenjena'),
('Ever Fresa Malvinas', 'Fresa jumbo'),
('Ever Fresa Malvinas', 'Fresa 2da'),
('Fredy López', 'Plátano maduro'),
('Fredy López', 'Plátano verde'),
('Fredy López', 'Plátano negro'),
('Fredy López', 'Guineo'),
('Cindy Lorena', 'Lechuga hidropónica'),
('Cindy Lorena', 'Cogollo'),
('Cindy Lorena', 'Mix'),
('Cindy Lorena', 'Kale kilo'),
('Cindy Lorena', 'Kale bandeja'),
('Cindy Lorena', 'Rúgula bandeja'),
('Cindy Lorena', 'Lechuga morada'),
('Cindy Lorena', 'Lechuga romana'),
('Cindy Lorena', 'Tomate cherry'),
('Diana La Mona', 'Arándanos libra'),
('Diana La Mona', 'Champiñón parís'),
('Diana La Mona', 'Portobello'),
('Diana La Mona', 'Crimini'),
('Diana La Mona', 'Raíz china'),
('Diana La Mona', 'Tomatillo'),
('Diana La Mona', 'Bulbo de hinojo'),
('Diana La Mona', 'Higos'),
('Diana La Mona', 'Orellana'),
('Diana La Mona', 'Toronja'),
('Diana La Mona', 'Ñame'),
('Diana La Mona', 'Guayaba feijoa'),
('Diana La Mona', 'Guisantes'),
('Diana La Mona', 'Habichuelina'),
('Diana La Mona', 'Perlita'),
('Diana La Mona', 'Batata'),
('Diana La Mona', 'Coco'),
('Eliana La Rojita', 'Maíz dulce'),
('Eliana La Rojita', 'Papaya'),
('Eliana La Rojita', 'Ahuyamín'),
('Eliana La Rojita', 'Gulupa'),
('Eliana La Rojita', 'Sandía baby'),
('Eliana La Rojita', 'Melón'),
('Eliana La Rojita', 'Murrapo'),
('Cereté', 'Cherry'),
('Cereté', 'Uvalina'),
('Pipe Palacio', 'Piña'),
('Andrés Hincapié', 'Aguacate hass verde'),
('Andrés Hincapié', 'Aguacate hass maduro'),
('Andrés Hincapié', 'Aguacate hass pintón'),
('Ferney WF', 'Cebolla puerro'),
('Ferney WF', 'Hojas de bijao'),
('Ferney WF', 'Albahaca'),
('Ferney WF', 'Ají dulce'),
('Ferney WF', 'Cebollín'),
('Ferney WF', 'Romero'),
('Ferney WF', 'Apio'),
('Ferney WF', 'Hierbabuena'),
('Ferney WF', 'Ají dulce verde'),
('Ferney WF', 'Yacón'),
('Ferney WF', 'Perejil crespo'),
('Ferney WF', 'Ají rocoto'),
('Ferney WF', 'Col china'),
('Ferney WF', 'Coles'),
('Ferney WF', 'Cidra'),
('Ferney WF', 'Laurel'),
('Ferney WF', 'Eucalipto'),
('Ferney WF', 'Rábano'),
('Ferney WF', 'Espinaca bogotona'),
('Ferney WF', 'Espinaca común'),
('Ferney WF', 'Pepino de rellenar'),
('Ferney WF', 'Menta'),
('Ferney WF', 'Ají dulce rojo'),
('Ferney WF', 'Tomillo'),
('Ferney WF', 'Acelga'),
('Ferney WF', 'Perejil liso'),
('Ferney WF', 'Eneldo'),
('Ferney WF', 'Orégano'),
('Ferney WF', 'Manzanilla'),
('Sebastián Castaño', 'Mango verde'),
('Sebastián Castaño', 'Mango pintón'),
('Sebastián Castaño', 'Mango maduro'),
('Sebastián Castaño', 'Mango azúcar'),
('Frutas López', 'Manzana verde'),
('Frutas López', 'Manzana gala'),
('Frutas López', 'Pera'),
('Frutas López', 'Uva chilena'),
('Frutas López', 'Uva roja bandeja'),
('Frutas López', 'Granadilla'),
('Frutas López', 'Kiwi'),
('Frutas López', 'Uva isabela'),
('Frutas López', 'Ajo'),
('Frutas López', 'Arándanos'),
('LyA Maracuyá', 'Naranja valencia'),
('LyA Maracuyá', 'Tangelo'),
('LyA Maracuyá', 'Maracuyá'),
('LyA Maracuyá', 'Mandarina'),
('LyA Maracuyá', 'Guayaba pera'),
('LyA Maracuyá', 'Limón tahity'),
('Milton', 'Cebolla larga'),
('Jovani 15', 'Limón mandarino'),
('Fernando Ramas Malvinas', 'Cimarrón'),
('Fernando Ramas Malvinas', 'Estrago'),
('Fabio Comino Malvinas', 'Comino maduro'),
('Fabio Comino Malvinas', 'Comino pintón'),
('Fabio Comino Malvinas', 'Comino verde'),
('Depósito El Socio', 'Pimentón rojo'),
('Depósito El Socio', 'Pimentón verde'),
('Depósito El Socio', 'Pimentón amarillo'),
('Depósito El Socio', 'Pepino europeo'),
('Depósito El Socio', 'Echalote'),
('Embandejados Mayey', 'Mora'),
('Embandejados Mayey', 'Uchuva'),
('Embandejados Mayey', 'Uva isabela'),
('Embandejados Mayey', 'Lulo'),
('Embandejados Mayey', 'Guayaba manzana'),
('Embandejados Mayey', 'Carambolo'),
('Embandejados Mayey', 'Mango tomy'),
('Embandejados Mayey', 'Maíz dulce'),
('Otros', 'Banano pintón'),
('Otros', 'Banano maduro'),
('Otros', 'Banano verde'),
('Otros', 'Arveja desgranada'),
('Otros', 'Guayaba feijoa'),
('Otros', 'Estragón'),
('Otros', 'Cimarrón'),
('Otros', 'Papayuelas'),
('Otros', 'Murrapo'),
('Agrofrutos', 'Papa capira'),
('Agrofrutos', 'Papa capira tronco'),
('Agrofrutos', 'Brócoli'),
('Agrofrutos', 'Coliflor'),
('Agrofrutos', 'Repollo blanco'),
('Agrofrutos', 'Repollo morado'),
('Agrofrutos', 'Cilantro'),
('Agrofrutos', 'Lechuga batavia'),
('Agrofrutos', 'Frijol'),
('Agrofrutos', 'Jengibre'),
('Agrofrutos', 'Sukini'),
('Agrofrutos', 'Calabacín'),
('Agrofrutos', 'Habichuela'),
('Agrofrutos', 'Ahuyamín'),
('Agrofrutos', 'Arracacha'),
('Agrofrutos', 'Papa nevada'),
('Agrofrutos', 'Remolacha'),
('Agrofrutos', 'Papa criolla'),
('Agrofrutos', 'Criolla balín'),
('Agrofrutos', 'Espinaca común'),
('Agrofrutos', 'Zanahoria'),
('Agrofrutos', 'Tomate árbol'),
('Agrofrutos', 'Pepino');

INSERT INTO producto_proveedores (producto_id, proveedor_id)
SELECT DISTINCT pr.id, pv.id
FROM tmp_proveedor_producto t
JOIN proveedores pv ON pv.nombre = t.proveedor
JOIN productos   pr ON pr.nombre = t.producto
ON DUPLICATE KEY UPDATE producto_id = producto_proveedores.producto_id;

-- Comprobación: debe salir VACÍO. Si sale alguna fila, esa relación no se pudo crear.
SELECT t.proveedor, t.producto AS producto_sin_relacion
FROM tmp_proveedor_producto t
LEFT JOIN proveedores pv ON pv.nombre = t.proveedor
LEFT JOIN productos   pr ON pr.nombre = t.producto
WHERE pv.id IS NULL OR pr.id IS NULL;

DROP TEMPORARY TABLE tmp_proveedor_producto;

COMMIT;
