/* Panel "Mi pedido" (<dialog> modal) + armado del mensaje de WhatsApp. Se descarga al abrir el panel por
   primera vez desde js/pedido.js, que ya dejó el catálogo cargado. El DOM del panel se crea en el primer uso. */
(function () {
  "use strict";
  const P = window.Pedido, MAX_URL = 1800;
  const root = document.documentElement;
  const $ = (s, r) => (r || document).querySelector(s);
  const money = (n, mon) => formatearPrecio(n, mon); // formato único (js/config.js)
  const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const esAcc = (p) => p.categoria === "Accesorios";
  const pideModelo = (p) => esAcc(p) && /^(Fundas|Vidrios y protección)$/.test(p.subcategoria || "");
  const RAIZ = P.BASE.replace(/js\/$/, "");
  let panel = null, ui = {}, suc = "", canje = "", intento = false, confirmando = false;

  /* ---------- precios y mensaje ---------- */
  function precioDe(p) { // { n, mon } o null (sin precio confirmado)
    if (!Number.isFinite(p.precioNum) || p.precioNum <= 0) return null;
    if (esAcc(p)) return typeof ACCESORIOS_CONFIG !== "undefined" && ACCESORIOS_CONFIG.mostrarPrecio === true ? { n: p.precioNum, mon: p.moneda === "USD" ? "USD" : "ARS" } : null;
    return p.moneda === "USD" || p.moneda === "ARS" ? { n: p.precioNum, mon: p.moneda } : null;
  }
  const lineas = () => P.items().map((it) => ({ it, p: P.mapa().get(it.id) }));
  const condicion = (p) => (P.usado(p) ? "Usado" + (TL.bateriaDe(p) !== null ? " · Batería " + TL.bateriaDe(p) + "%" : "") : "Nuevo");
  const variante = (p, it) => [TL.variante(p, it.c), it.m && pideModelo(p) ? "para " + it.m : ""].filter(Boolean).join(" · ");
  const sucNombre = (k) => (typeof SUCURSALES !== "undefined" && SUCURSALES[k] ? SUCURSALES[k].nombre : k);

  // Subtotales SEPARADOS (equipos / accesorios); nunca se suman monedas distintas
  function subtotal(vivos) {
    if (!vivos.length) return null;
    const pr = vivos.map((l) => precioDe(l.p));
    if (pr.some((x) => !x)) return "A confirmar por WhatsApp";
    const s = {};
    pr.forEach((x, i) => { s[x.mon] = (s[x.mon] || 0) + x.n * vivos[i].it.q; });
    return Object.keys(s).map((m) => money(s[m], m)).join(" + "); // una suma por moneda: nunca se mezclan
  }
  const grupos = (v) => ({ eq: subtotal(v.filter((l) => !esAcc(l.p))), ac: subtotal(v.filter((l) => esAcc(l.p))) });

  function armar(vivos, compacto) {
    const sep = compacto ? " - " : " — ", conf = compacto ? "a confirmar" : "precio a confirmar";
    const L = ["Hola Tecnolab, quiero consultar por este pedido:"];
    vivos.forEach((l, i) => {
      const pr = precioDe(l.p), v = variante(l.p, l.it);
      L.push((i + 1) + ") " + l.p.nombre + (v ? sep + v : "") + (compacto ? "" : " (" + condicion(l.p) + ")") + " x" + l.it.q + sep + (pr ? money(pr.n * l.it.q, pr.mon) : conf));
    });
    if (canje) L.push("Mi equipo para entregar: " + canje);
    (P.aplicablesPromo(vivos.map((l) => ({ p: l.p, q: l.it.q, c: l.it.c, m: l.it.m }))) || []).forEach((t) => L.push("Promo: " + t));
    const g = grupos(vivos), st = [];
    if (g.eq) st.push("Subtotal equipos: " + g.eq);
    if (g.ac) st.push("Subtotal accesorios: " + g.ac);
    L.push(st.join(" | "), "Retiro en: Sucursal " + sucNombre(suc), "Los precios son orientativos y se confirman en el local.");
    return L.join("\n");
  }
  function urlWa(vivos) {
    const mk = (t) => "https://wa.me/" + SITE_CONFIG.whatsappNumber + "?text=" + encodeURIComponent(t);
    const u = mk(armar(vivos, false));
    return u.length > MAX_URL ? mk(armar(vivos, true)) : u; // pedidos largos: formato compacto
  }

  /* ---------- panel ---------- */
  const SVG_X = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';
  const SVG_BOLSA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 8h14l-1 12H6L5 8z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/></svg>';

  function crear() {
    const sucs = typeof SUCURSALES !== "undefined" ? Object.keys(SUCURSALES) : [];
    panel = document.createElement("dialog");
    panel.className = "pedido-dialog";
    panel.setAttribute("aria-labelledby", "pedido-titulo");
    panel.innerHTML =
      '<header class="pedido-head"><h2 id="pedido-titulo">Mi pedido</h2><button type="button" class="pedido-cerrar" aria-label="Cerrar Mi pedido">' + SVG_X + "</button></header>" +
      '<div class="pedido-vacio" hidden>' + SVG_BOLSA + '<p><strong>Tu pedido está vacío</strong></p><a class="btn btn-primary" href="' + RAIZ + 'catalogo.html">Ver catálogo</a></div>' +
      '<div class="pedido-cuerpo"><ul class="pedido-lista"></ul>' +
      '<fieldset class="pedido-suc" role="radiogroup" aria-describedby="pedido-aviso"><legend>Retiro en <span aria-hidden="true">*</span></legend>' +
      sucs.map((k) => '<label><input type="radio" name="pedido-suc" value="' + k + '"><span>' + esc(SUCURSALES[k].nombre) + "</span></label>").join("") + "</fieldset>" +
      '<label class="pedido-campo" for="pedido-canje">Mi equipo para entregar (Plan Canje) <small>Opcional</small></label>' +
      '<input id="pedido-canje" class="pedido-input" maxlength="80" placeholder="Ej: iPhone 13 128GB, batería 88%" autocomplete="off">' +
      '<div class="pedido-resumen"></div></div>' +
      '<footer class="pedido-pie"><p class="pedido-aviso" id="pedido-aviso"></p>' +
      '<button type="button" class="btn btn-primary pedido-enviar" aria-describedby="pedido-aviso">Enviar pedido por WhatsApp</button>' +
      '<div class="pedido-vaciar"></div></footer><div class="sr-only" aria-live="polite"></div>';
    const q = (s) => $(s, panel);
    ui = { lista: q(".pedido-lista"), resumen: q(".pedido-resumen"), aviso: q(".pedido-aviso"), enviar: q(".pedido-enviar"), vaciar: q(".pedido-vaciar"),
      vacio: q(".pedido-vacio"), cuerpo: q(".pedido-cuerpo"), pie: q(".pedido-pie"), live: q("[aria-live]"), suc: q(".pedido-suc") };
    document.body.append(panel);
    q(".pedido-cerrar").addEventListener("click", () => panel.close());
    panel.addEventListener("click", (e) => { if (e.target === panel) panel.close(); });
    panel.addEventListener("close", () => {
      root.classList.remove("dialog-open"); root.style.removeProperty("--sbw");
      anim(280); confirmando = false;
      const b = $(".cart-btn"); if (b) b.focus();
    });
    ui.suc.addEventListener("change", (e) => { suc = e.target.value; estado(); });
    q("#pedido-canje").addEventListener("input", (e) => { canje = P.limpiar(e.target.value, 80); });
    ui.lista.addEventListener("input", (e) => {
      const l = P.items()[e.target.dataset.k];
      if (l && e.target.matches(".pedido-modelo")) { l.m = P.limpiar(e.target.value, 40); P.guardar(); estado(); }
    });
    ui.lista.addEventListener("click", (e) => {
      const b = e.target.closest("[data-a]"); if (!b) return;
      const it = P.items(), i = Number(b.dataset.k), a = b.dataset.a;
      if (!it[i]) return;
      if (a === "x") it.splice(i, 1); else it[i].q = Math.min(P.MAX_Q, Math.max(1, it[i].q + (a === "+" ? 1 : -1)));
      P.guardar(); P.cambio(a === "x" ? "Producto quitado del pedido" : null);
      ((a !== "x" && $('[data-k="' + i + '"][data-a="' + a + '"]', ui.lista)) || q(".pedido-cerrar")).focus(); // el foco no se pierde al redibujar
    });
    ui.enviar.addEventListener("click", () => {
      const vivos = lineas().filter((l) => l.p), f = faltantes(vivos);
      if (!vivos.length) return;
      if (f.suc || f.modelos.length) {
        intento = true; marcarCampos(f);
        (f.modelos.length ? $('.pedido-modelo[data-k="' + f.modelos[0].i + '"]', panel) : $("input[name=pedido-suc]", panel)).focus();
        return;
      }
      window.open(urlWa(vivos), "_blank", "noopener");
    });
    ui.vaciar.addEventListener("click", (e) => {
      const a = e.target.closest("button"); if (!a) return;
      if (a.dataset.v === "si") { confirmando = false; P.vaciar(); P.cambio("Pedido vaciado"); return; }
      confirmando = a.dataset.v === "pedir";
      renderVaciar();
      $(confirmando ? '[data-v="no"]' : '[data-v="pedir"]', ui.vaciar).focus();
    });
  }

  const faltantes = (vivos) => ({ suc: !suc, modelos: vivos.map((l) => ({ l, i: P.items().indexOf(l.it) })).filter((x) => pideModelo(x.l.p) && !x.l.it.m) });
  function marcarCampos(f) {
    ui.suc.classList.toggle("is-invalid", intento && f.suc);
    panel.querySelectorAll(".pedido-modelo").forEach((inp) => {
      const mal = intento && f.modelos.some((x) => String(x.i) === inp.dataset.k);
      inp.classList.toggle("is-invalid", mal);
      inp.setAttribute("aria-invalid", String(mal));
    });
  }
  function estado() { // aviso y estado del botón de envío (sin redibujar los campos que se escriben)
    const vivos = lineas().filter((l) => l.p), f = faltantes(vivos), m = [];
    if (f.suc) m.push("Elegí la sucursal de retiro.");
    if (f.modelos.length) m.push("Completá el modelo de tu iPhone en: " + f.modelos.map((x) => x.l.p.nombre).join(", ") + ".");
    ui.aviso.textContent = !vivos.length && P.items().length ? "Los productos de tu pedido ya no están disponibles." : m.join(" ");
    ui.enviar.setAttribute("aria-disabled", String(!vivos.length || m.length > 0));
    marcarCampos(f);
  }
  const renderVaciar = () => {
    ui.vaciar.innerHTML = confirmando
      ? '<span>¿Vaciar todo el pedido?</span> <button type="button" data-v="si">Sí, vaciar</button> <button type="button" data-v="no">Cancelar</button>'
      : '<button type="button" data-v="pedir">Vaciar pedido</button>';
  };
  function fila(l, i) {
    const it = l.it, p = l.p, k = ' data-k="' + i + '"';
    const quitar = (n) => '<button type="button" class="pedido-quitar" data-a="x"' + k + ' aria-label="Quitar ' + esc(n) + ' del pedido">' + SVG_X + "</button>";
    if (!p) return '<li class="pedido-item is-no"><div class="pedido-item-info"><p class="pedido-item-nombre">Ya no disponible</p></div>' + quitar("producto") + "</li>";
    const img = (p.colores || [])[it.c] || (p.colores || [])[0], pr = precioDe(p), v = TL.variante(p, it.c), u = P.usado(p);
    return '<li class="pedido-item"><div class="pedido-thumb">' + (img ? '<img src="' + esc(RAIZ + img.imagen) + '" alt="" width="56" height="56">' : SVG_BOLSA) + "</div>" +
      '<div class="pedido-item-info"><p class="pedido-item-nombre">' + esc(p.nombre) + "</p>" + (v ? '<p class="pedido-item-var">' + esc(v) + "</p>" : "") +
      (u ? '<span class="pedido-tag">' + esc(condicion(p)) + "</span>" : "") +
      (pideModelo(p) ? '<label class="pedido-campo" for="pm-' + i + '">Modelo de tu iPhone <span aria-hidden="true">*</span></label><input id="pm-' + i + '" class="pedido-input pedido-modelo"' + k + ' maxlength="40" placeholder="Ej: iPhone 15 Pro" value="' + esc(it.m) + '" required aria-describedby="pedido-aviso" autocomplete="off">' : "") +
      '<div class="pedido-fila">' + (u ? '<span class="pedido-unica">Unidad única</span>'
        : '<div class="pedido-qty" role="group" aria-label="Cantidad de ' + esc(p.nombre) + '"><button type="button" data-a="-"' + k + ' aria-label="Menos"' + (it.q <= 1 ? " disabled" : "") + '>−</button><output>' + it.q + '</output><button type="button" data-a="+"' + k + ' aria-label="Más"' + (it.q >= P.MAX_Q ? " disabled" : "") + ">+</button></div>") +
      '<span class="pedido-precio">' + (pr ? money(pr.n * it.q, pr.mon) : esAcc(p) ? "Precio a confirmar" : "A confirmar") + "</span></div></div>" + quitar(p.nombre) + "</li>";
  }
  function render(aviso) {
    if (!panel || !panel.open) return;
    const ls = lineas(), vivos = ls.filter((l) => l.p), vacio = !ls.length;
    ui.vacio.hidden = !vacio; ui.cuerpo.hidden = vacio; ui.pie.hidden = vacio;
    ui.lista.innerHTML = ls.map(fila).join("");
    const g = grupos(vivos), r = [];
    if (g.eq) r.push("<div><dt>Subtotal equipos</dt><dd>" + esc(g.eq) + "</dd></div>");
    if (g.ac) r.push("<div><dt>Subtotal accesorios</dt><dd>" + esc(g.ac) + "</dd></div>");
    const promos = P.promosAplicables(vivos.map((l) => ({ p: l.p }))).filter((pr) => (pr.regalos || []).length)
      .map((pr) => '<p class="pedido-promo">Incluye de regalo: ' + esc(listaRegalos(pr.regalos)) + " (promo vigente)</p>").join("");
    ui.resumen.innerHTML = promos + (r.length ? "<dl>" + r.join("") + "</dl>" : "") + "<p>Precios y disponibilidad sujetos a confirmación en el local. El pedido no reserva stock.</p>";
    const radio = $('input[value="' + suc + '"]', ui.suc); if (radio) radio.checked = true;
    renderVaciar(); estado();
    if (aviso) ui.live.textContent = aviso;
  }
  function anim(ms) { // will-change solo durante la animación
    panel.classList.add("is-anim");
    clearTimeout(panel._t); panel._t = setTimeout(() => panel.classList.remove("is-anim"), ms);
  }
  P.render = render;
  P.abrirPanel = function () {
    if (!panel) crear();
    if (panel.open) return;
    root.style.setProperty("--sbw", window.innerWidth - root.clientWidth + "px");
    root.classList.add("dialog-open");
    anim(450);
    panel.showModal();
    render();
  };
})();
