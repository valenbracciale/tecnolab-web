/**
 * Productos desde Supabase. Se carga DESPUÉS de products-data.js / accesorios-data.js y ANTES de main.js.
 * Mapea las filas de public.productos a la misma forma que ya consume main.js, reemplazando en el lugar el contenido de
 * CATALOGO_DESTACADO (equipos) y ACCESORIOS_BASE (accesorios). Si la API falla, tarda más de 4 s o devuelve algo vacío,
 * quedan los datos estáticos: el catálogo nunca queda vacío. Respuesta cacheada ~60 s en sessionStorage.
 */
(function () {
  "use strict";
  if (typeof CATALOGO_DESTACADO === "undefined" || typeof SUPABASE_URL === "undefined" || typeof SUPABASE_ANON_KEY === "undefined") return;

  const TIMEOUT_MS = 4000, CACHE_MS = 60000, CACHE_KEY = "tecnolab_productos_v1";
  const COLUMNAS = "id,categoria,subcategoria,nombre,variante,especificacion,precio_num,precio_texto,regalo,disponible,oferta,precio_anterior,fotos,colores";

  function aplicar(filas) {
    if (!Array.isArray(filas)) return false;
    const equipos = [], accesorios = [];
    filas.forEach((r) => {
      if (!r || !r.id || !r.nombre) return;
      const colores = Array.isArray(r.colores) ? r.colores : [];
      if (r.categoria === "Accesorios") {
        const fotos = (Array.isArray(r.fotos) ? r.fotos : []).filter((x) => x && x.url);
        const f = fotos.find((x) => x.principal) || fotos[0];
        accesorios.push([r.subcategoria || "", r.nombre, r.precio_num == null ? null : Number(r.precio_num), f ? f.url : (colores[0] && colores[0].imagen) || undefined]);
        return;
      }
      const p = {
        id: r.id, categoria: r.categoria, nombre: r.nombre, variante: r.variante || "", especificacion: r.especificacion || "",
        precio: r.precio_texto == null ? "Consultar" : r.precio_texto,
        precioNum: r.precio_num == null ? null : Number(r.precio_num),
        colores, disponible: r.disponible !== false, oferta: r.oferta === true,
        precioAnterior: r.precio_anterior == null ? null : Number(r.precio_anterior), regalo: r.regalo === true
      };
      if (r.subcategoria) p.subcategoria = r.subcategoria;
      equipos.push(p);
    });
    if (!equipos.length) return false; // respuesta inservible: se queda lo estático
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
  fetch(SUPABASE_URL + "/rest/v1/productos?select=" + COLUMNAS + "&order=orden.asc", {
    headers: { apikey: SUPABASE_ANON_KEY, Accept: "application/json" },
    signal: ctrl ? ctrl.signal : undefined
  })
    .then((r) => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
    .then((filas) => { if (!liberado && aplicar(filas)) guardar(filas); })
    .catch(() => { /* respaldo: datos estáticos */ })
    .then(() => { clearTimeout(t); liberar(); });
})();
