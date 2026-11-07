#!/usr/bin/env node
/*
 * Carga inicial (idempotente) de js/products-data.js + js/accesorios-data.js en public.productos (upsert por id).
 *
 * Correr (Node 18+), desde la raíz del repo, en bash:
 *   SUPABASE_URL=https://kkdnxxwdstpekkehzrde.supabase.co SUPABASE_SERVICE_KEY=<service_role key> node scripts/seed-supabase.js
 * o poniendo esas dos variables en .env.local (ignorado por git) y corriendo:
 *   node scripts/seed-supabase.js
 *
 * No incluye la columna `moneda` a propósito: en filas nuevas queda el default ARS y en las existentes no se pisa.
 * (Sí repone precios y datos de catálogo: no correrlo de nuevo si ya se editaron productos desde el panel.)
 * La service key NUNCA va en el repo ni en archivos del sitio. Antes, correr supabase/schema.sql en el SQL Editor.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const raiz = path.join(__dirname, '..');
for (const f of ['.env.local', '.env']) {
  const p = path.join(raiz, f);
  if (!fs.existsSync(p)) continue;
  for (const l of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = l.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
const URL_ = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const KEY = process.env.SUPABASE_SERVICE_KEY;
if (!URL_ || !KEY) { console.error('Faltan SUPABASE_URL y/o SUPABASE_SERVICE_KEY (variables de entorno o .env.local).'); process.exit(1); }

const leer = (f, expr) => vm.runInNewContext(fs.readFileSync(path.join(raiz, 'js', f), 'utf8') + '\n;(' + expr + ')', {});
const { CATALOGO_DESTACADO } = leer('products-data.js', '{ CATALOGO_DESTACADO }');
const { ACCESORIOS_BASE } = leer('accesorios-data.js', '{ ACCESORIOS_BASE }');
// promos: solo para marcar regalo = true donde hoy la promo vigente lleva regalos
let promos = {};
try { promos = leer('promos-data.js', '{ promosDe: typeof promosDe === "function" ? promosDe : null }'); } catch (e) { /* sin promos */ }

const normalizar = (t) => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const tieneRegalo = (p) => { try { return !!(promos.promosDe && promos.promosDe(p).some((x) => (x.regalos || []).length)); } catch (e) { return false; } };

const filas = [];
CATALOGO_DESTACADO.forEach((p, i) => {
  const colores = p.colores || [];
  filas.push({
    id: p.id, categoria: p.categoria, subcategoria: p.subcategoria || null, nombre: p.nombre,
    variante: p.variante || null, especificacion: p.especificacion || null,
    precio_num: Number.isFinite(p.precioNum) ? p.precioNum : null, precio_texto: p.precio == null ? null : String(p.precio),
    regalo: tieneRegalo(p), disponible: p.disponible !== false, oferta: p.oferta === true,
    precio_anterior: Number.isFinite(p.precioAnterior) ? p.precioAnterior : null,
    destacado: true, orden: i,
    fotos: colores.filter((c) => c.imagen).map((c, k) => ({ url: c.imagen, path: null, principal: k === 0 })),
    colores
  });
});
const usados = new Set();
ACCESORIOS_BASE.forEach(([subcategoria, nombre, precioNum, foto], i) => {
  const base = normalizar(nombre).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  let id = base;
  for (let n = 2; usados.has(id); n++) id = base + '-' + n;
  usados.add(id);
  filas.push({
    id, categoria: 'Accesorios', subcategoria, nombre, variante: '', especificacion: '',
    precio_num: Number.isFinite(precioNum) ? precioNum : null, precio_texto: null,
    regalo: false, disponible: true, oferta: false, precio_anterior: null, destacado: false, orden: 1000 + i,
    fotos: foto ? [{ url: foto, path: null, principal: true }] : [], colores: []
  });
});

(async () => {
  const r = await fetch(URL_ + '/rest/v1/productos?on_conflict=id', {
    method: 'POST',
    headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(filas)
  });
  if (!r.ok) { console.error('Error ' + r.status + ': ' + (await r.text())); process.exit(1); }
  console.log('OK: ' + filas.length + ' productos cargados (' + CATALOGO_DESTACADO.length + ' equipos + ' + ACCESORIOS_BASE.length + ' accesorios).');
})().catch((e) => { console.error(e.message); process.exit(1); });
