-- Pegar completo en Supabase → SQL Editor → Run. Es idempotente (se puede correr más de una vez).

create table if not exists public.productos (
  id text primary key,
  categoria text,
  subcategoria text,
  nombre text,
  variante text,
  especificacion text,
  precio_num numeric,
  precio_texto text,
  regalo boolean default false,
  disponible boolean default true,
  oferta boolean default false,
  precio_anterior numeric,           -- siempre en la misma moneda del producto (columna moneda)
  destacado boolean default false,
  orden int,
  fotos jsonb default '[]'::jsonb,   -- [{ url, path, principal }]
  colores jsonb default '[]'::jsonb, -- [{ nombre, hex, imagen }]
  updated_at timestamptz default now()
);

-- Moneda del producto (precio_num y precio_anterior). Idempotente: en tablas ya creadas agrega la columna; los existentes quedan en ARS.
alter table public.productos add column if not exists moneda text not null default 'ARS' check (moneda in ('ARS', 'USD'));

-- Estado del producto (Nuevo / Usado). Idempotente: en tablas ya creadas agrega la columna; los existentes quedan en 'nuevo'.
alter table public.productos add column if not exists condicion text not null default 'nuevo' check (condicion in ('nuevo', 'usado'));

create index if not exists productos_orden_idx on public.productos (orden);

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists productos_set_updated_at on public.productos;
create trigger productos_set_updated_at
  before update on public.productos
  for each row execute function public.set_updated_at();

alter table public.productos enable row level security;

drop policy if exists "productos_select_publico" on public.productos;
create policy "productos_select_publico" on public.productos
  for select to anon, authenticated using (true);

drop policy if exists "productos_insert_auth" on public.productos;
create policy "productos_insert_auth" on public.productos
  for insert to authenticated with check (true);

drop policy if exists "productos_update_auth" on public.productos;
create policy "productos_update_auth" on public.productos
  for update to authenticated using (true) with check (true);

drop policy if exists "productos_delete_auth" on public.productos;
create policy "productos_delete_auth" on public.productos
  for delete to authenticated using (true);

-- Permisos explícitos (la API no expone tablas nuevas por defecto)
grant usage on schema public to anon, authenticated;
grant select on public.productos to anon;
grant select, insert, update, delete on public.productos to authenticated;
grant select, insert, update, delete on public.productos to service_role;

-- Storage: bucket de lectura pública, 5 MB, solo webp/jpeg/png
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('productos', 'productos', true, 5242880, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update
  set public = true,
      file_size_limit = 5242880,
      allowed_mime_types = array['image/webp', 'image/jpeg', 'image/png'];

drop policy if exists "productos_storage_lectura" on storage.objects;
create policy "productos_storage_lectura" on storage.objects
  for select to anon, authenticated using (bucket_id = 'productos');

drop policy if exists "productos_storage_insert" on storage.objects;
create policy "productos_storage_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'productos');

drop policy if exists "productos_storage_update" on storage.objects;
create policy "productos_storage_update" on storage.objects
  for update to authenticated using (bucket_id = 'productos') with check (bucket_id = 'productos');

drop policy if exists "productos_storage_delete" on storage.objects;
create policy "productos_storage_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'productos');
