-- Pegar en Supabase → SQL Editor → Run. Solo agrega la moneda; no toca nada más. Se puede correr más de una vez.
-- precio_num y precio_anterior usan esta misma moneda. Los productos existentes quedan en pesos (ARS).
alter table public.productos
  add column if not exists moneda text not null default 'ARS' check (moneda in ('ARS', 'USD'));
