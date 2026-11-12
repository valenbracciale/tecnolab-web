/* Pop-up promocional centrado (solo index.html y catalogo.html). Los datos viven en js/promos-data.js.
   Modal (role="dialog" aria-modal="true") sobre un fondo oscuro: foco al abrir, trampa de foco, Esc / clic en el fondo / ✕
   para cerrar, devolución del foco y scroll del fondo bloqueado sin salto de layout. Aparece a los 4 s o al 25 % de scroll
   (lo que ocurra primero), una vez por sesión; si se cierra, no vuelve durante frecuenciaHoras (24 h). Solo transform y opacity. */
(function () {
  "use strict";
  if (typeof PROMOS === "undefined" || typeof promoVigente !== "function") return;
  const SALIDA_MS = 220, RETRASO_MS = 4000;
  const $ = (s, r) => (r || document).querySelector(s);
  const pagina = (location.pathname.split("/").pop() || "index.html").replace(/\.html$/, "") || "index";
  const reducido = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const clave = (promo) => "tecnolab_promo_" + promo.id;
  const mem = {}; // respaldo si localStorage está bloqueado (vale solo para esta página)
  let vistaSesion = false; // respaldo si sessionStorage está bloqueado
  const claveSes = (promo) => "tecnolab_promo_sesion_" + promo.id;
  function vistaEnSesion(promo) { let v = vistaSesion; try { v = v || sessionStorage.getItem(claveSes(promo)) === "1"; } catch (e) { /* bloqueado */ } return v; }
  function marcarSesion(promo) { vistaSesion = true; try { sessionStorage.setItem(claveSes(promo), "1"); } catch (e) { /* bloqueado */ } }

  function vistaReciente(promo) {
    const horas = (promo.popup && promo.popup.frecuenciaHoras) || 0;
    let ts = mem[promo.id] || 0;
    try { ts = Math.max(ts, Number(localStorage.getItem(clave(promo))) || 0); } catch (e) { /* bloqueado */ }
    return ts > 0 && Date.now() - ts < horas * 3600000;
  }
  function recordar(promo) {
    mem[promo.id] = Date.now();
    try { localStorage.setItem(clave(promo), String(Date.now())); } catch (e) { /* bloqueado */ }
  }

  const promo = promoVigente(new Date()).find((p) => p.popup && p.popup.mostrar === true && (p.popup.paginas || []).includes(pagina) && !vistaReciente(p) && !vistaEnSesion(p));
  if (!promo) return;

  /* ---------- cuándo aparece: a los 4 s O al 25 % de scroll (lo primero); sin otro diálogo ni aviso encima ---------- */
  let disparado = false, tarjeta = null, overlay = null, espera = 0, foco0 = null;
  const bloqueado = () => !!$("dialog[open]") || !!$(".pedido-toast.is-show");
  function intentar() {
    if (tarjeta || !disparado || espera) return;
    if (!bloqueado()) { mostrar(); return; }
    espera = setInterval(() => { if (!bloqueado()) { clearInterval(espera); espera = 0; mostrar(); } }, 400); // espera a que se cierre
  }
  const alScroll = () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    if (max > 0 && scrollY / max >= 0.25) disparar();
  };
  const disparar = () => {
    if (disparado) return;
    disparado = true;
    removeEventListener("scroll", alScroll);
    intentar();
  };
  addEventListener("scroll", alScroll, { passive: true });
  setTimeout(disparar, RETRASO_MS);

  /* ---------- tarjeta ---------- */
  const ICONOS = {
    cargador: '<path d="M9 3v4M15 3v4M7 7h10v3a5 5 0 0 1-10 0V7zM12 15v4a2 2 0 0 0 2 2h2"/>',
    funda: '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><rect x="9.5" y="5" width="3.5" height="3.5" rx="1"/>',
    vidrio: '<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z"/><path d="M9 12l2 2 4-4"/>',
    regalo: '<rect x="4" y="9" width="16" height="11" rx="1.5"/><path d="M12 9v11M3 9h18M12 9c-2.5 0-4-1-4-2.5S9.5 4 12 9zM12 9c2.5 0 4-1 4-2.5S14.5 4 12 9z"/>'
  };
  const icono = (t) => {
    const k = /cargador/i.test(t) ? "cargador" : /funda/i.test(t) ? "funda" : /vidrio|templado/i.test(t) ? "vidrio" : "regalo";
    return '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONOS[k] + "</svg>";
  };
  const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function representativo() { // primer producto del catálogo que coincide y tiene foto
    const lista = typeof CATALOGO_DESTACADO !== "undefined" ? CATALOGO_DESTACADO : [];
    const p = lista.find((x) => promoAplica(promo, x) && (x.colores || []).length);
    return p ? { src: p.colores[0].imagen, alt: p.nombre } : null;
  }

  function mostrar() {
    const img = representativo(), c = promo.cta || {}, regalos = (promo.regalos || []).filter(Boolean);
    const wa = c.mensaje && typeof SITE_CONFIG !== "undefined" ? "https://wa.me/" + SITE_CONFIG.whatsappNumber + "?text=" + encodeURIComponent(c.mensaje) : "";
    let n = 0;
    const st = () => ' data-st style="--i:' + n++ + '"'; // elementos que entran escalonados
    overlay = document.createElement("div");
    overlay.className = "promo-overlay";
    tarjeta = document.createElement("div");
    tarjeta.className = "promo-card";
    tarjeta.setAttribute("role", "dialog");
    tarjeta.setAttribute("aria-modal", "true");
    tarjeta.tabIndex = -1;
    tarjeta.setAttribute("aria-labelledby", "promo-titulo");
    tarjeta.innerHTML =
      '<button type="button" class="promo-cerrar" aria-label="Cerrar promoción"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button>' +
      '<div class="promo-cuerpo">' +
      (img ? '<div class="promo-thumb"' + st() + '><img src="' + esc(img.src) + '" alt="' + esc(img.alt) + '" width="96" height="96"></div>' : "") +
      '<div class="promo-info">' +
      '<h2 id="promo-titulo" class="promo-titulo"' + st() + ">" + esc(promo.titulo || "") + "</h2>" +
      (promo.texto ? '<p class="promo-texto"' + st() + ">" + esc(promo.texto) + "</p>" : "") + "</div></div>" +
      (regalos.length ? '<ul class="promo-chips"' + st() + ">" + regalos.map((r) => "<li>" + icono(r) + "<span>" + esc(r) + "</span></li>").join("") + "</ul>" : "") +
      (promo.fin ? '<p class="promo-nota">Válido hasta ' + esc(fechaLegible(promo.fin)) + "</p>" : "") +
      (promo.condiciones ? '<p class="promo-nota">' + esc(promo.condiciones) + "</p>" : "") +
      '<div class="promo-acciones"' + st() + ">" +
      (wa ? '<a class="btn btn-primary promo-cta" href="' + wa + '" target="_blank" rel="noopener">' + esc(c.texto || "Consultar por WhatsApp") + "</a>" : "") +
      '<a class="promo-ver" href="catalogo.html">Ver equipos</a></div>';
    overlay.append(tarjeta);
    foco0 = document.activeElement;
    bloquearScroll();
    document.body.append(overlay);
    marcarSesion(promo);
    tarjeta.classList.add("is-in");
    overlay.addEventListener("click", (e) => { if (e.target === overlay) cerrar(); });
    $(".promo-cerrar", tarjeta).addEventListener("click", () => cerrar());
    const cta = $(".promo-cta", tarjeta);
    if (cta) cta.addEventListener("click", () => { recordar(promo); cerrar(); });
    document.addEventListener("keydown", alTeclado);
    (cta || $(".promo-cerrar", tarjeta)).focus({ preventScroll: true });
  }
  const FOCABLES = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';
  function alTeclado(e) {
    if (!tarjeta) return;
    if (e.key === "Escape") { e.preventDefault(); cerrar(); return; }
    if (e.key !== "Tab") return;
    const f = Array.from(tarjeta.querySelectorAll(FOCABLES)).filter((x) => x.offsetParent !== null);
    if (!f.length) { e.preventDefault(); tarjeta.focus(); return; }
    const p = f[0], u = f[f.length - 1];
    if (e.shiftKey && (document.activeElement === p || !tarjeta.contains(document.activeElement))) { e.preventDefault(); u.focus(); }
    else if (!e.shiftKey && (document.activeElement === u || !tarjeta.contains(document.activeElement))) { e.preventDefault(); p.focus(); }
  }

  /* ---------- scroll del fondo bloqueado, sin salto de layout (compensa el ancho de la barra de scroll) ---------- */
  function bloquearScroll() {
    const de = document.documentElement, barra = innerWidth - de.clientWidth;
    de.classList.add("promo-abierto");
    if (barra > 0) de.style.setProperty("--promo-barra", barra + "px");
  }
  function liberarScroll() {
    const de = document.documentElement;
    de.classList.remove("promo-abierto");
    de.style.removeProperty("--promo-barra");
  }

  function quitar() {
    if (!overlay) return;
    overlay.remove(); overlay = null; tarjeta = null;
    liberarScroll();
    document.removeEventListener("keydown", alTeclado);
    if (foco0 && foco0.focus && document.contains(foco0)) { try { foco0.focus({ preventScroll: true }); } catch (e) { /* sin foco */ } }
    foco0 = null;
  }
  function cerrar() {
    const o = overlay;
    if (!o || o.dataset.saliendo) return;
    o.dataset.saliendo = "1";
    recordar(promo);
    o.classList.add("is-out");
    let hecho = false;
    const listo = () => { if (hecho) return; hecho = true; if (overlay === o) quitar(); };
    o.addEventListener("animationend", (e) => { if (e.target === o) listo(); });
    setTimeout(listo, SALIDA_MS + 120); // respaldo
  }
})();
