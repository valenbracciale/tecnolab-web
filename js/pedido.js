/* "Mi pedido": carrito de CONSULTA (sin pagos). Arma un mensaje de WhatsApp; retiro solo en sucursal.
   Este archivo (liviano, en todas las páginas) guarda el pedido, pinta el contador del header, agrega productos y
   muestra el aviso. El panel (js/pedido-panel.js) se descarga recién al abrirlo por primera vez.
   Se guardan solo referencias {id, c: índice de color, q: cantidad, m: modelo}; nombre, precio e imagen salen
   del catálogo actual. Depende de js/config.js y de window.TL (js/main.js). */
(function () {
  "use strict";
  const KEY = "tecnolab_pedido_v1", MAX_LINEAS = 20, MAX_Q = 5;
  const BASE = ((document.currentScript && document.currentScript.src) || "").replace(/[^/]*$/, "");
  const $ = (s, r) => (r || document).querySelector(s);
  const limpiar = (v, max) => String(v || "").replace(/<[^>]*>/g, "").replace(/[\u0000-\u001f<>]/g, "").replace(/\s+/g, " ").slice(0, max).trim();
  const usado = (p) => p.condicion === "usado";
  let items = [], mapa = null, cargando = null, previo = -1, toast = null, tTimer = 0;

  /* ---------- almacenamiento (en try/catch: puede estar bloqueado o corrupto) ---------- */
  function leer() {
    try {
      const d = JSON.parse(localStorage.getItem(KEY));
      if (!Array.isArray(d)) return [];
      return d.filter((x) => x && typeof x.id === "string" && x.id).slice(0, MAX_LINEAS)
        .map((x) => ({ id: x.id, c: Math.max(0, parseInt(x.c, 10) || 0), q: Math.min(MAX_Q, Math.max(1, parseInt(x.q, 10) || 1)), m: limpiar(x.m, 40) }));
    } catch (e) { return []; }
  }
  function guardar() { try { localStorage.setItem(KEY, JSON.stringify(items)); } catch (e) { /* sigue en memoria */ } }

  /* ---------- catálogo (en las páginas que no lo traen, se pide al primer uso) ---------- */
  const cargarJs = (n) => new Promise((ok) => { const s = document.createElement("script"); s.src = BASE + n; s.onload = s.onerror = ok; document.head.append(s); });
  function catalogo() {
    return mapa ? Promise.resolve(mapa) : cargando || (cargando = (async () => {
      if (typeof CATALOGO_DESTACADO === "undefined") await cargarJs("products-data.js");
      if (typeof ACCESORIOS_BASE === "undefined") await cargarJs("accesorios-data.js");
      if (typeof PROMOS === "undefined") await cargarJs("promos-data.js");
      const base = typeof CATALOGO_DESTACADO !== "undefined" ? CATALOGO_DESTACADO : [];
      mapa = new Map([...base, ...(window.TL ? TL.expandirAccesorios() : [])].map((p) => [p.id, p]));
      return mapa;
    })());
  }

  /* ---------- contador del header y botones de equipos usados ---------- */
  function pintarBadge() {
    const b = $(".cart-btn"), n = items.reduce((a, x) => a + x.q, 0);
    if (!b) return;
    const c = $(".cart-count", b);
    b.setAttribute("aria-label", "Mi pedido, " + n + (n === 1 ? " producto" : " productos"));
    c.hidden = n === 0;
    c.textContent = n > 99 ? "99+" : n;
    if (previo >= 0 && n !== previo && n > 0) { c.classList.remove("is-bump"); void c.offsetWidth; c.classList.add("is-bump"); } // el CSS lo anula con reduced-motion
    previo = n;
  }
  function marcar() { // un usado es unidad única: si ya está, su botón dice «En tu pedido»
    document.querySelectorAll("[data-add][data-usado]").forEach((b) => {
      const t = $(".add-txt", b), en = items.some((x) => x.id === b.dataset.add);
      if (!b.dataset.orig && t) b.dataset.orig = t.textContent;
      b.setAttribute("aria-disabled", String(en));
      if (t && !b.dataset.fb) t.textContent = en ? "En tu pedido" : b.dataset.orig;
    });
  }
  function cambio(aviso) {
    pintarBadge(); marcar();
    if (API.render) API.render(aviso);
  }

  /* ---------- aviso breve ---------- */
  function avisar(texto, ok) {
    if (!toast) {
      toast = document.createElement("div");
      toast.className = "pedido-toast";
      toast.setAttribute("role", "status");
      toast.setAttribute("aria-live", "polite");
      toast.innerHTML = '<span class="pedido-toast-txt"></span><button type="button" class="pedido-toast-ver">Ver pedido</button>';
      $(".pedido-toast-ver", toast).addEventListener("click", () => { toast.classList.remove("is-show"); abrir(); });
    }
    const d = $("dialog[open]"); // sobre un detalle modal el aviso va dentro (el resto de la página está inerte)
    (d || document.body).append(toast);
    toast.classList.toggle("in-dialog", !!d);
    toast.classList.toggle("is-ok", !!ok);
    const txt = $(".pedido-toast-txt", toast);
    if (ok) txt.innerHTML = '<span class="t-l">' + texto + '</span><span class="t-c">Agregado al pedido</span>'; // ≤340px: versión corta
    else txt.textContent = texto;
    void toast.offsetWidth;
    toast.classList.add("is-show");
    clearTimeout(tTimer);
    tTimer = setTimeout(() => toast.classList.remove("is-show"), 3500); // otro aviso reinicia el temporizador (un solo aviso)
  }

  /* ---------- agregar ---------- */
  async function agregar(id, c) {
    const p = (await catalogo()).get(id);
    if (!p) return "no";
    c = Math.max(0, Math.min(Math.max(0, (p.colores || []).length - 1), c | 0));
    const l = items.find((x) => x.id === id && (usado(p) || x.c === c));
    if (l) {
      if (usado(p)) return "ya";
      if (l.q >= MAX_Q) return "max";
      l.q++;
    } else {
      if (items.length >= MAX_LINEAS) return "lleno";
      items.push({ id, c, q: 1, m: "" });
    }
    guardar();
    cambio(p.nombre + " agregado al pedido");
    return "ok";
  }
  const MSG = { ok: "Agregado a tu pedido", ya: "Ese equipo es unidad única y ya está en tu pedido", max: "Máximo " + MAX_Q + " unidades por producto", lleno: "Tu pedido admite hasta " + MAX_LINEAS + " productos", no: "Ese producto ya no está disponible" };
  document.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-add]");
    if (!b || b.getAttribute("aria-disabled") === "true") return;
    let c = Number(b.dataset.c) || 0;
    const card = b.closest(".product-card");
    if (card) c = Math.max(0, [...card.querySelectorAll(".color-swatch")].findIndex((s) => s.classList.contains("is-active")));
    const r = await agregar(b.dataset.add, c);
    avisar(MSG[r], r === "ok");
    if (r === "ok" && !b.dataset.fb) { // «Agregado ✓» 1,2 s
      const t = $(".add-txt", b), o = t.textContent;
      b.dataset.fb = "1"; t.textContent = "Agregado "; const ck = document.createElement("span"); ck.className = "add-check"; ck.textContent = "✓"; t.append(ck);
      setTimeout(() => { delete b.dataset.fb; t.textContent = o; marcar(); }, 1200);
    }
  });

  /* ---------- abrir el panel (descarga js/pedido-panel.js la primera vez) ---------- */
  async function abrir() {
    await catalogo();
    if (!API.abrirPanel) await cargarJs("pedido-panel.js");
    const d = $(".product-dialog[open]");
    if (d) await new Promise((ok) => { d.addEventListener("close", ok, { once: true }); d.close(); });
    if (API.abrirPanel) API.abrirPanel();
  }

  /* ---------- arranque ---------- */
  const API = {
    // Promos vigentes que alcanzan a algún producto del pedido (ítems [{ p, ... }])
    promosAplicables: (its) => (typeof promoVigente === "function" ? promoVigente(new Date()).filter((pr) => its.some((it) => promoAplica(pr, it.p))) : []),
    // Textos para el mensaje de WhatsApp: «{titulo} — regalos: {lista}»
    aplicablesPromo: (its) => API.promosAplicables(its).map((pr) => pr.titulo + ((pr.regalos || []).length ? " — regalos: " + listaRegalos(pr.regalos) : "")),
    agregar, abrir, marcar, cambio, guardar, limpiar, usado, BASE, MAX_Q,
    items: () => items,
    vaciar: () => { items = []; guardar(); },
    mapa: () => mapa
  };
  window.Pedido = API;
  items = leer();
  pintarBadge(); marcar();
  const btn = $(".cart-btn");
  if (btn) btn.addEventListener("click", abrir);
  window.addEventListener("storage", (e) => {
    if (e.key !== KEY && e.key !== null) return;
    items = leer(); cambio(null);
  });
})();
