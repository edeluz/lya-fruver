CREATE SCHEMA IF NOT EXISTS fruver;

-- ============================================
-- L&A FRUVER - Creación de base de datos
-- Ejecutar este script completo en:
-- Supabase → SQL Editor → New query → pegar todo → Run
-- ============================================

-- Proveedores
create table proveedores (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  telefono text,
  notas text,
  creado_en timestamptz default now()
);

-- Productos (catálogo)
create table productos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  unidad text not null default 'unidad',
  precio numeric,
  disponible boolean not null default true,
  creado_en timestamptz default now()
);

-- Relación producto <-> proveedores que lo surten (varios a varios)
create table producto_proveedores (
  producto_id uuid references productos(id) on delete cascade,
  proveedor_id uuid references proveedores(id) on delete cascade,
  primary key (producto_id, proveedor_id)
);

-- Clientes
create table clientes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  telefono text,
  creado_en timestamptz default now()
);

-- Pedidos (encabezado)
create table pedidos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references clientes(id),
  cliente_nombre text not null, -- respaldo en texto por si el cliente es nuevo
  creado_en timestamptz default now()
);

-- Detalle de cada pedido (uno o varios productos por pedido)
create table pedido_items (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid references pedidos(id) on delete cascade,
  producto_id uuid references productos(id),
  producto_nombre text not null, -- respaldo en texto
  cantidad numeric not null,
  unidad text not null,
  observacion text,
  creado_en timestamptz default now()
);

-- Habilitar acceso público controlado (RLS = seguridad a nivel de fila)
alter table proveedores enable row level security;
alter table productos enable row level security;
alter table producto_proveedores enable row level security;
alter table clientes enable row level security;
alter table pedidos enable row level security;
alter table pedido_items enable row level security;

-- Políticas: permitir lectura y escritura pública
-- (adecuado para esta app de uso interno/con link compartido; sin login individual)
create policy "lectura publica proveedores" on proveedores for select using (true);
create policy "escritura publica proveedores" on proveedores for all using (true) with check (true);

create policy "lectura publica productos" on productos for select using (true);
create policy "escritura publica productos" on productos for all using (true) with check (true);

create policy "lectura publica producto_proveedores" on producto_proveedores for select using (true);
create policy "escritura publica producto_proveedores" on producto_proveedores for all using (true) with check (true);

create policy "lectura publica clientes" on clientes for select using (true);
create policy "escritura publica clientes" on clientes for all using (true) with check (true);

create policy "lectura publica pedidos" on pedidos for select using (true);
create policy "escritura publica pedidos" on pedidos for all using (true) with check (true);

create policy "lectura publica pedido_items" on pedido_items for select using (true);
create policy "escritura publica pedido_items" on pedido_items for all using (true) with check (true);

-- ============================================
-- L&A FRUVER - Carga inicial del catálogo de productos
-- Ejecutar DESPUÉS de 01-crear-tablas.sql
-- ============================================

insert into productos (nombre, unidad) values
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
('Uva verde sin semilla','kg'),('Yuca','kg'),('Zanahoria','kg');

-- Ejecutar en Supabase → SQL Editor

alter table clientes add column direccion text;
alter table clientes add column activo boolean not null default true;
alter table clientes add column actualizado_en timestamptz default now();

alter table proveedores add column direccion text;
alter table proveedores add column activo boolean not null default true;
alter table proveedores add column actualizado_en timestamptz default now();

-- Ejecutar en Supabase → SQL Editor

create sequence factura_numero_seq start 1;

create table facturas (
  id uuid primary key default gen_random_uuid(),
  numero bigint not null default nextval('factura_numero_seq') unique,
  cliente_id uuid references clientes(id),
  cliente_nombre text not null,
  cliente_telefono text,
  cliente_direccion text,
  pedido_id uuid references pedidos(id),
  fecha date not null default current_date,
  flete numeric not null default 0,
  total numeric not null default 0,
  creado_en timestamptz default now()
);

create table factura_items (
  id uuid primary key default gen_random_uuid(),
  factura_id uuid references facturas(id) on delete cascade,
  producto_nombre text not null,
  cantidad numeric not null,
  unidad text not null,
  precio_unitario numeric not null default 0,
  subtotal numeric not null default 0
);

alter table facturas enable row level security;
alter table factura_items enable row level security;
create policy "lectura publica facturas" on facturas for select using (true);
create policy "escritura publica facturas" on facturas for all using (true) with check (true);
create policy "lectura publica factura_items" on factura_items for select using (true);
create policy "escritura publica factura_items" on factura_items for all using (true) with check (true);

-- Ejecutar en Supabase → SQL Editor
alter table pedidos add column origen text not null default 'cliente'; -- 'cliente' o 'admin'