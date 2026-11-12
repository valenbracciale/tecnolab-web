alter table public.productos add column if not exists condicion text not null default 'nuevo' check (condicion in ('nuevo', 'usado'));
