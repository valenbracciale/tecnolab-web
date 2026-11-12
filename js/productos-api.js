/**
 * Productos desde Supabase. Se carga DESPUÉS de products-data.js / accesorios-data.js y ANTES de main.js.
 * Mapea las filas de public.productos a la misma forma que ya consume main.js, reemplazando en el lugar el contenido de
 * CATALOGO_DESTACADO (equipos) y ACCESORIOS_BASE (accesorios). Si la API falla, tarda más de 4 s o devuelve algo vacío,
 * quedan los datos estáticos: el catálogo nunca queda vacío. Respuesta cacheada ~60 s en sessionStorage.
 */
(function () {
  "use strict";
  if (typeof CATALOGO_DESTACADO === "undefined" || typeof SUPABASE_URL === "undefined" || typeof SUPABASE_ANON_KEY === "undefined") return;

  const TIMEOUT_MS = 4000, CACHE_MS = 60000, CACHE_KEY = "tecnolab_productos_v3";
  const COLUMNAS = "id,categoria,subcategoria,nombre,variante,especificacion,precio_num,precio_texto,regalo,disponible,oferta,precio_anterior,moneda,fotos,colores";
  const COLUMNAS_COND = COLUMNAS + ",condicion"; // si la migración de «condicion» aún no se corrió en Supabase, se reintenta sin ella

  // Fotos del producto: urls con la principal (o la primera) al frente
  function urlsDe(fotos) {
    const l = (Array.isArray(fotos) ? fotos : []).filter((x) => x && typeof x.url === "string" && x.url);
    const i = l.findIndex((x) => x.principal === true);
    return (i > 0 ? [l[i], ...l.slice(0, i), ...l.slice(i + 1)] : l).map((x) => x.url);
  }

  // Con datos de Supabase, `regalo` manda: false quita los regalos de la promo aunque la promo los tenga; true los muestra.
  // Sin Supabase (respaldo estático) el producto no trae `regalo` y todo sigue como antes.
  // Se envuelve promoAplica (promos-data.js): la usan promosDe (cards y detalle) y pedido.js (regalo en «Mi pedido»).
  let promoEnvuelta = false;
  function regaloManda() {
    if (promoEnvuelta || typeof promoAplica !== "function") return;
    promoEnvuelta = true;
    const original = promoAplica;
    window.promoAplica = function (promo, prod) {
      const conRegalos = !!(promo && (promo.regalos || []).filter(Boolean).length);
      if (conRegalos && prod && prod.regalo === false) return false;
      if (conRegalos && prod && prod.regalo === true) return true;
      return original.apply(this, arguments);
    };
  }

  function aplicar(filas) {
    if (!Array.isArray(filas)) return false;
    const equipos = [], accesorios = [];
    filas.forEach((r) => {
      if (!r || !r.id || !r.nombre) return;
      const colores = Array.isArray(r.colores) ? r.colores : [];
      if (r.categoria === "Accesorios") {
        const urls = urlsDe(r.fotos);
        accesorios.push([r.subcategoria || "", r.nombre, r.precio_num == null ? null : Number(r.precio_num), urls[0] || (colores[0] && colores[0].imagen) || undefined, urls, r.regalo === true, r.moneda === "USD" ? "USD" : "ARS"]);
        return;
      }
      const p = {
        id: r.id, categoria: r.categoria, nombre: r.nombre, variante: r.variante || "", especificacion: r.especificacion || "",
        precio: r.precio_texto == null ? "Consultar" : r.precio_texto,
        precioNum: r.precio_num == null ? null : Number(r.precio_num),
        moneda: r.moneda === "USD" ? "USD" : "ARS", colores, disponible: r.disponible !== false, oferta: r.oferta === true,
        precioAnterior: r.precio_anterior == null ? null : Number(r.precio_anterior), regalo: r.regalo === true,
        condicion: r.condicion === "usado" ? "usado" : "nuevo" // sin dato (respaldo / caché viejo) = nuevo
      };
      p.fotos = urlsDe(r.fotos);
      if (r.subcategoria) p.subcategoria = r.subcategoria;
      equipos.push(p);
    });
    if (!equipos.length) return false; // respuesta inservible: se queda lo estático
    regaloManda();
    CATALOGO_DESTACADO.splice(0, CATALOGO_DESTACADO.length, ...equipos);
    if (accesorios.length && typeof ACCESORIOS_BASE !== "undefined") ACCESORIOS_BASE.splice(0, ACCESORIOS_BASE.length, ...accesorios);
    return true;
  }

  function desdeCache() {
    try {
      const c = JSON.parse(sessionStorage.getItem(CACHE_KEY));
      if (c && Date.now() - c.t < CACHE_MS && aplicar(c.filas)) return true;
    } catch (e) { /* sin sessionStorage o dato corrupto */ }
    return false;
  }
  function guardar(filas) {
    try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), filas })); } catch (e) { /* lleno o bloqueado */ }
  }

  if (desdeCache()) return;

  // main.js arma todo en DOMContentLoaded: se lo retiene hasta tener la respuesta (máx. 4 s) y se lo vuelve a disparar.
  let liberado = false;
  document.addEventListener("DOMContentLoaded", (e) => { if (!liberado) e.stopImmediatePropagation(); });
  function liberar() {
    if (liberado) return;
    liberado = true;
    if (document.readyState !== "loading") document.dispatchEvent(new Event("DOMContentLoaded", { bubbles: true }));
  }

  const ctrl = typeof AbortController === "function" ? new AbortController() : null;
  const t = setTimeout(() => { if (ctrl) ctrl.abort(); liberar(); }, TIMEOUT_MS);
  const pedir = (cols) => fetch(SUPABASE_URL + "/rest/v1/productos?select=" + cols + "&order=orden.asc", {
    headers: { apikey: SUPABASE_ANON_KEY, Accept: "application/json" },
    signal: ctrl ? ctrl.signal : undefined
  }).then((r) => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); });
  pedir(COLUMNAS_COND).catch(() => pedir(COLUMNAS))
    .then((filas) => { if (!liberado && aplicar(filas)) guardar(filas); })
    .catch(() => { /* respaldo: datos estáticos */ })
    .then(() => { clearTimeout(t); liberar(); });
})();
