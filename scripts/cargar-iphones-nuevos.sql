-- ============================================================================
-- Cargar iPhones nuevos (un producto por modelo, con selector de color)
-- Pegar en Supabase -> SQL Editor -> Run. Es idempotente: ON CONFLICT (id) DO NOTHING
-- (se puede correr dos veces; nunca pisa un producto que ya exista ni lo que se edite desde el panel).
--
-- ATENCIÓN: No correr hasta que el filtro de disponible esté publicado
-- (js/productos-api.js, aplicar(): oculta disponible = false); si no, los productos aparecen sin precio.
--
-- Todos entran con disponible = false (ocultos), condicion 'nuevo', precio vacío (precio_num NULL, precio_texto 'Consultar'),
-- fotos [] (cada color lleva su propia foto en colores[].imagen), sin variante ni especificación (capacidades por completar).
-- Para publicar: en el panel admin completar precio/capacidades y marcar el producto como disponible.
--
-- Los colores marcados con "-- CONFIRMAR" hay que confirmarlos con el dueño antes de publicar.
-- ============================================================================

-- Por si las migraciones de moneda/condición no se corrieron (idempotente; no cambia nada si ya están):
alter table public.productos add column if not exists moneda text not null default 'ARS' check (moneda in ('ARS', 'USD'));
alter table public.productos add column if not exists condicion text not null default 'nuevo' check (condicion in ('nuevo', 'usado'));

-- iPhone 14
insert into public.productos (id, categoria, nombre, variante, especificacion, precio_num, precio_texto, moneda, condicion, regalo, disponible, oferta, destacado, orden, fotos, colores)
select 'iphone-14', 'iPhone', 'iPhone 14', '', '', null, 'Consultar', 'ARS', 'nuevo', false, false, false, false,
  coalesce((select max(orden) from public.productos where categoria = 'iPhone'), 0) + 1,
  '[]'::jsonb,
  '[{"nombre":"Azul","hex":"#a7c1d9","imagen":"assets/img/iphone-14-azul.webp"},
    {"nombre":"Blanco","hex":"#f2efe9","imagen":"assets/img/iphone-14-blanco.webp"},
    {"nombre":"Rojo","hex":"#bf0a1f","imagen":"assets/img/iphone-14-rojo.webp"}]'::jsonb
on conflict (id) do nothing;

-- iPhone 14 Pro Max
--   CONFIRMAR: Oro (iphone-14-pro-max-amarillo.webp) — se ve dorado; el archivo dice «amarillo»; foto de baja resolución
--   CONFIRMAR: Plata (iphone-14-pro-max-blanco.webp) — se ve plateado; el archivo dice «blanco»; foto de baja resolución
insert into public.productos (id, categoria, nombre, variante, especificacion, precio_num, precio_texto, moneda, condicion, regalo, disponible, oferta, destacado, orden, fotos, colores)
select 'iphone-14-pro-max', 'iPhone', 'iPhone 14 Pro Max', '', '', null, 'Consultar', 'ARS', 'nuevo', false, false, false, false,
  coalesce((select max(orden) from public.productos where categoria = 'iPhone'), 0) + 2,
  '[]'::jsonb,
  '[{"nombre":"Oro","hex":"#e4cfa8","imagen":"assets/img/iphone-14-pro-max-amarillo.webp"},
    {"nombre":"Plata","hex":"#e5e4e2","imagen":"assets/img/iphone-14-pro-max-blanco.webp"},
    {"nombre":"Morado","hex":"#5e4c78","imagen":"assets/img/iphone-14-pro-max-morado.webp"},
    {"nombre":"Negro","hex":"#2b2b2d","imagen":"assets/img/iphone-14-pro-max-negro.webp"}]'::jsonb
on conflict (id) do nothing;

-- iPhone 15
--   CONFIRMAR: Verde (iphone-15-verde.webp) — archivo sin modelo: parece iPhone 15; confirmar color y modelo
insert into public.productos (id, categoria, nombre, variante, especificacion, precio_num, precio_texto, moneda, condicion, regalo, disponible, oferta, destacado, orden, fotos, colores)
select 'iphone-15', 'iPhone', 'iPhone 15', '', '', null, 'Consultar', 'ARS', 'nuevo', false, false, false, false,
  coalesce((select max(orden) from public.productos where categoria = 'iPhone'), 0) + 3,
  '[]'::jsonb,
  '[{"nombre":"Amarillo","hex":"#f1e6a8","imagen":"assets/img/iphone-15-amarillo.webp"},
    {"nombre":"Celeste","hex":"#c7dbe6","imagen":"assets/img/iphone-15-celeste.webp"},
    {"nombre":"Negro","hex":"#2b2b2d","imagen":"assets/img/iphone-15-negro.webp"},
    {"nombre":"Rosa","hex":"#f0d3d0","imagen":"assets/img/iphone-15-rosa.webp"},
    {"nombre":"Verde","hex":"#cbd9c4","imagen":"assets/img/iphone-15-verde.webp"}]'::jsonb
on conflict (id) do nothing;

-- iPhone 15 Pro
--   CONFIRMAR: Titanio natural (iphone-15-pro-gris.webp) — el archivo dice «gris»; se ve titanio natural
insert into public.productos (id, categoria, nombre, variante, especificacion, precio_num, precio_texto, moneda, condicion, regalo, disponible, oferta, destacado, orden, fotos, colores)
select 'iphone-15-pro', 'iPhone', 'iPhone 15 Pro', '', '', null, 'Consultar', 'ARS', 'nuevo', false, false, false, false,
  coalesce((select max(orden) from public.productos where categoria = 'iPhone'), 0) + 4,
  '[]'::jsonb,
  '[{"nombre":"Titanio azul","hex":"#3d4a5e","imagen":"assets/img/iphone-15-pro-azul.webp"},
    {"nombre":"Titanio blanco","hex":"#e3e1dc","imagen":"assets/img/iphone-15-pro-blanco.webp"},
    {"nombre":"Titanio natural","hex":"#b9b1a6","imagen":"assets/img/iphone-15-pro-gris.webp"},
    {"nombre":"Titanio negro","hex":"#3a3a3c","imagen":"assets/img/iphone-15-pro-negro.webp"}]'::jsonb
on conflict (id) do nothing;

-- iPhone 15 Pro Max
insert into public.productos (id, categoria, nombre, variante, especificacion, precio_num, precio_texto, moneda, condicion, regalo, disponible, oferta, destacado, orden, fotos, colores)
select 'iphone-15-pro-max', 'iPhone', 'iPhone 15 Pro Max', '', '', null, 'Consultar', 'ARS', 'nuevo', false, false, false, false,
  coalesce((select max(orden) from public.productos where categoria = 'iPhone'), 0) + 5,
  '[]'::jsonb,
  '[{"nombre":"Titanio azul","hex":"#3d4a5e","imagen":"assets/img/iphone-15-pro-max-azul.webp"},
    {"nombre":"Titanio blanco","hex":"#e3e1dc","imagen":"assets/img/iphone-15-pro-max-blanco.webp"},
    {"nombre":"Titanio negro","hex":"#3a3a3c","imagen":"assets/img/iphone-15-pro-max-negro.webp"}]'::jsonb
on conflict (id) do nothing;

-- iPhone 16
--   CONFIRMAR: Ultramarino (iphone-16-lila.webp) — el archivo dice «lila»; se ve azul ultramar
--   CONFIRMAR: Verde azulado (iphone-16-verde.webp) — DUPLICADO: ya existe el producto «iphone-16-verde» (Verde azulado); no se toca, decide el dueño si se oculta
insert into public.productos (id, categoria, nombre, variante, especificacion, precio_num, precio_texto, moneda, condicion, regalo, disponible, oferta, destacado, orden, fotos, colores)
select 'iphone-16', 'iPhone', 'iPhone 16', '', '', null, 'Consultar', 'ARS', 'nuevo', false, false, false, false,
  coalesce((select max(orden) from public.productos where categoria = 'iPhone'), 0) + 6,
  '[]'::jsonb,
  '[{"nombre":"Blanco","hex":"#f2f2f0","imagen":"assets/img/iphone-16-blanco.webp"},
    {"nombre":"Ultramarino","hex":"#9aadf5","imagen":"assets/img/iphone-16-lila.webp"},
    {"nombre":"Negro","hex":"#3c4042","imagen":"assets/img/iphone-16-negro.webp"},
    {"nombre":"Rosa","hex":"#f2adda","imagen":"assets/img/iphone-16-rosa.webp"},
    {"nombre":"Verde azulado","hex":"#7fb5b0","imagen":"assets/img/iphone-16-verde.webp"}]'::jsonb
on conflict (id) do nothing;

-- iPhone 17
--   CONFIRMAR: Negro (iphone-17-gris.webp) — el archivo dice «gris»; se ve negro
--   CONFIRMAR: Lavanda (iphone-17-rosa.webp) — el archivo dice «rosa»; se ve lavanda
--   CONFIRMAR: Verde (iphone-17-verde.webp) — foto de baja resolución
insert into public.productos (id, categoria, nombre, variante, especificacion, precio_num, precio_texto, moneda, condicion, regalo, disponible, oferta, destacado, orden, fotos, colores)
select 'iphone-17', 'iPhone', 'iPhone 17', '', '', null, 'Consultar', 'ARS', 'nuevo', false, false, false, false,
  coalesce((select max(orden) from public.productos where categoria = 'iPhone'), 0) + 7,
  '[]'::jsonb,
  '[{"nombre":"Blanco","hex":"#f5f5f3","imagen":"assets/img/iphone-17-blanco.webp"},
    {"nombre":"Negro","hex":"#2b2b2d","imagen":"assets/img/iphone-17-gris.webp"},
    {"nombre":"Lavanda","hex":"#c9b8e0","imagen":"assets/img/iphone-17-rosa.webp"},
    {"nombre":"Verde","hex":"#b5c9a5","imagen":"assets/img/iphone-17-verde.webp"}]'::jsonb
on conflict (id) do nothing;

-- iPhone 17 Pro
insert into public.productos (id, categoria, nombre, variante, especificacion, precio_num, precio_texto, moneda, condicion, regalo, disponible, oferta, destacado, orden, fotos, colores)
select 'iphone-17-pro', 'iPhone', 'iPhone 17 Pro', '', '', null, 'Consultar', 'ARS', 'nuevo', false, false, false, false,
  coalesce((select max(orden) from public.productos where categoria = 'iPhone'), 0) + 8,
  '[]'::jsonb,
  '[{"nombre":"Plateado","hex":"#e8e8ea","imagen":"assets/img/iphone-17-pro-plateado.webp"},
    {"nombre":"Azul","hex":"#3b4a6b","imagen":"assets/img/iphone-17-pro-azul.webp"},
    {"nombre":"Celeste","hex":"#b9d3e3","imagen":"assets/img/iphone-17-pro-celeste.webp"},
    {"nombre":"Naranja","hex":"#e07a3f","imagen":"assets/img/iphone-17-pro-naranja.webp"}]'::jsonb
on conflict (id) do nothing;

-- iPhone 17e
insert into public.productos (id, categoria, nombre, variante, especificacion, precio_num, precio_texto, moneda, condicion, regalo, disponible, oferta, destacado, orden, fotos, colores)
select 'iphone-17e', 'iPhone', 'iPhone 17e', '', '', null, 'Consultar', 'ARS', 'nuevo', false, false, false, false,
  coalesce((select max(orden) from public.productos where categoria = 'iPhone'), 0) + 9,
  '[]'::jsonb,
  '[{"nombre":"Blanco","hex":"#f5f5f3","imagen":"assets/img/iphone-17e-blanco.webp"},
    {"nombre":"Negro","hex":"#2b2b2d","imagen":"assets/img/iphone-17e-negro.webp"}]'::jsonb
on conflict (id) do nothing;

-- iPhone 18 Pro
--   CONFIRMAR: Borravino (iphone-18-pro-borravino.webp) — color sin verificar; FOTO PROVISORIA de baja resolución (224x300 útiles): reemplazar
insert into public.productos (id, categoria, nombre, variante, especificacion, precio_num, precio_texto, moneda, condicion, regalo, disponible, oferta, destacado, orden, fotos, colores)
select 'iphone-18-pro-borravino', 'iPhone', 'iPhone 18 Pro', '', '', null, 'Consultar', 'ARS', 'nuevo', false, false, false, false,
  coalesce((select max(orden) from public.productos where categoria = 'iPhone'), 0) + 10,
  '[]'::jsonb,
  '[{"nombre":"Borravino","hex":"#6b2d3c","imagen":"assets/img/iphone-18-pro-borravino.webp"}]'::jsonb
on conflict (id) do nothing;

