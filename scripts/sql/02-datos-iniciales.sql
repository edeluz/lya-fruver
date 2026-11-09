-- ============================================
-- L&A FRUVER - Datos iniciales (catálogo de productos)
-- Ejecutar DESPUÉS de 01-esquema.sql.
-- Se puede volver a ejecutar sin duplicar: si un producto ya existe (mismo nombre),
-- no se modifica.
-- ============================================

USE fruver_lya;

INSERT INTO productos (nombre, unidad) VALUES
('Acelga','kg'),('Aguacate','kg'),('Ahuyama','kg'),('Ají dulce','kg'),('Ajo','kg'),
('Albahaca','atado'),('Apio','unidad'),('Arándanos','kg'),('Arracacha','kg'),('Arveja','kg'),
('Banano','kg'),('Berenjena','kg'),('Brócoli','unidad'),('Caléndula','kg'),('Cebolla blanca','kg'),
('Cebolla morada','kg'),('Cebolla rama','atado'),('Cebolla roja','kg'),('Champiñón','caja'),('Cidra','kg'),
('Cilantro','atado'),('Coco','unidad'),('Cogollo europeo','unidad'),('Coliflor','unidad'),('Durazno','kg'),
('Echalote morada','kg'),('Eneldo','atado'),('Espárragos','atado'),('Espinaca','atado'),('Eucalipto','atado'),
('Fresa','kg'),('Granadilla','unidad'),('Habichuela','kg'),('Hierbabuena','atado'),('Hinojo bulbo','kg'),
('Hojas de bijao','paquete'),('Kiwi','unidad'),('Lechuga batavia','unidad'),('Lechuga crespa','unidad'),
('Lechuga romana','unidad'),('Limón','kg'),('Limón mandarino','kg'),('Limón tahití','kg'),('Lulo','kg'),
('Maíz dulce','kg'),('Mandarina','unidad'),('Mango de azúcar','unidad'),('Mango tommy','unidad'),
('Mango verde','kg'),('Manzana roja','kg'),('Manzana royal','kg'),('Manzana verde','kg'),('Melón','unidad'),
('Mix de lechuga','bolsa'),('Mora','kg'),('Naranja','kg'),('Naranja tangelo','kg'),('Naranja valencia','kg'),
('Papa blanca','kg'),('Papa capira','kg'),('Papa criolla','kg'),('Papa negra','kg'),('Papa nevada','kg'),
('Papaya','unidad'),('Pepino cohombro','unidad'),('Pera verde','kg'),('Perejil liso','atado'),
('Pimentón rojo','kg'),('Piña oro miel','unidad'),('Pino','atado'),('Pitahaya','unidad'),
('Plátano maduro','kg'),('Plátano verde','kg'),('Pulpa de maracuyá','kg'),('Remolacha','kg'),
('Repollo blanco','unidad'),('Repollo morado','unidad'),('Salvia','atado'),('Sandía','unidad'),
('Sandía baby','unidad'),('Tomate cherry','kg'),('Tomate chonto','kg'),('Tomate de árbol','kg'),
('Tomate san marzano','kg'),('Uchuva','kg'),('Uva chilena','kg'),('Uva isabela','kg'),
('Uva verde sin semilla','kg'),('Yuca','kg'),('Zanahoria','kg')
ON DUPLICATE KEY UPDATE nombre = nombre;
