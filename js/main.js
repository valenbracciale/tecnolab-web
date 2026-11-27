/* Interruptor de emergencia del efecto Liquid Glass del header: false → siempre el vidrio simple. */
const GLASS_LIQUID_ENABLED = true;

/* Parámetros de la refracción (un solo lugar para ajustarlos). Escala = cuánto desplaza cada canal
   el filtro SVG (desplazamiento máx. ≈ escala / 2 px); la diferencia entre canales da las franjas
   rojo/azul. Bisel = ancho en px de la franja del borde donde se curva la "lente". */
const LG = { escalaR: 70, escalaG: 66, escalaB: 62, bisel: 30 };

/* Efecto 3D de las cards: inclinación máxima (grados) y paralaje de la imagen (px). */
const TILT_MAX = 6;
const TILT_PARALLAX = 5;

/* Opiniones — franja de reseñas en loop y ventanas con fotos. Tiempos en ms, tamaños en px.
   CLIENTES_FOTOS: para sumar fotos nuevas alcanza con agregar el nombre del archivo (en assets/img/clientes/). */
const CLIENTES_FOTOS = ["cliente-1.webp", "cliente-2.webp", "cliente-3.webp", "cliente-4.webp", "cliente-5.webp", "cliente-6.webp"];
const OPINIONES_FX = {
  celdaObjetivo: 140,   // ancho de celda buscado; columnas = round(ancho / celdaObjetivo), celda = ancho / columnas
  maxVisibles: 10,
  entradaMs: 450,       // ease-out, escala 0.96 → 1
  permanenciaMs: 1200,
  salidaMs: 1600,
  escalaInicial: 0.96,
  opacidadMax: 1,       // opacidad de las fotos (las celdas que tocan texto usan opacidadTexto)
  opacidadTexto: 0.15,  // opacidad máxima de las celdas que tocan texto ([data-foto-evitar])
  margenTexto: 6,       // px de aire alrededor de cada bloque de texto
  resizeDebounceMs: 150,
  recientesSinRepetir: 2,
  autoIntervalo: 100,   // modo autónomo: ms entre apariciones
  maxActivas: 14,       // tope de celdas activas a la vez (mouse + autónomo); si no hay lugar se salta la vuelta
  poolExtra: 4,         // el pool tiene al menos maxActivas + poolExtra celdas (no se crean nodos en cada aparición)
  intensidadMin: 0.25,  // modo autónomo: opacidad máxima por foto = intensidad aleatoria (× opacidadMax)
  intensidadMax: 1,
  autoPermMin: 900,     // permanencia (antes del fade-out) de las fotos más intensas
  autoPermMax: 2200     // permanencia de las más tenues
};
const FRANJA_SEG_POR_TARJETA = 16; // duración del loop de reseñas = cantidad de tarjetas × este valor (s)

document.addEventListener("DOMContentLoaded", () => {
  /* ============================================================
     NAV MOBILE
     ============================================================ */
  const navToggle = document.querySelector(".nav-toggle");
  const mainNav = document.querySelector(".main-nav");
  if (navToggle && mainNav) {
    // Celular (≤768): botón de WhatsApp al final del menú y capa que oscurece el resto de la página (clic = cerrar)
    const wa = document.createElement("a");
    wa.className = "btn btn-primary nav-wa";
    wa.target = "_blank"; wa.rel = "noopener"; wa.textContent = "WhatsApp";
    wa.dataset.wa = "Hola, quiero hacer una consulta";
    wa.href = "https://wa.me/5492614699026";
    mainNav.append(wa);
    const navScrim = document.createElement("div");
    navScrim.className = "nav-m-scrim";
    navScrim.setAttribute("aria-hidden", "true");
    document.body.append(navScrim);
    const setNav = (open, devolverFoco) => {
      mainNav.classList.toggle("is-open", open);
      document.documentElement.classList.toggle("nav-open", open);
      navToggle.setAttribute("aria-expanded", String(open));
      navToggle.setAttribute("aria-label", open ? "Cerrar menú" : "Abrir menú");
      // el nav está antes que el botón en el DOM: al abrir, el foco pasa al primer link
      if (open) mainNav.querySelector("a")?.focus();
      else if (devolverFoco) navToggle.focus();
    };
    navToggle.addEventListener("click", () => { const abrir = !mainNav.classList.contains("is-open"); setNav(abrir, !abrir); });
    navScrim.addEventListener("click", () => setNav(false, true));
    mainNav.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => setNav(false));
    });
    // Escape cierra el menú y devuelve el foco al botón
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape" || !mainNav.classList.contains("is-open")) return;
      setNav(false, true);
    });
  }

  /* ============================================================
     HEADER ADAPTABLE — el tema del vidrio (data-theme="dark" | "light" sobre .site-header)
     lo decide la sección que está bajo el centro vertical del header, según su
     data-header-theme. Se observa una franja de 1px a esa altura. Si dos secciones la
     cruzan a la vez (la cortina de #why-tecnolab queda fija bajo #plan-canje) gana la
     que va después en el DOM, que es la que se ve por encima. Sin animación: el CSS
     solo transiciona el color (150ms).
     ============================================================ */
  function initHeaderTheme() {
    const header = document.querySelector(".site-header");
    const secciones = [...document.querySelectorAll("[data-header-theme]")];
    if (!header || !secciones.length || !("IntersectionObserver" in window)) return;
    const cruzan = new Set();
    let observer = null;

    const aplicar = () => {
      let elegida = null;
      cruzan.forEach((s) => {
        if (!elegida || (elegida.compareDocumentPosition(s) & Node.DOCUMENT_POSITION_FOLLOWING)) elegida = s;
      });
      if (elegida) {
        header.dataset.theme = elegida.dataset.headerTheme;
        // densidad del vidrio del bloque que está debajo: "" (limpio) | "tint" (velo) | "busy" (velo + blur 2px) | "heavy" (.is-busy: velo 0,45 + blur 6px)
        const dens = elegida.dataset.headerDensity || "";
        header.dataset.density = dens === "heavy" ? "busy" : dens;
        header.classList.toggle("is-busy", dens === "heavy");
      }
    };
    const observar = () => {
      if (observer) observer.disconnect();
      cruzan.clear();
      const caja = header.getBoundingClientRect();
      const centro = Math.round(caja.top + caja.height / 2);
      const abajo = Math.max(window.innerHeight - centro - 1, 0);
      observer = new IntersectionObserver((entradas) => {
        entradas.forEach((e) => { if (e.isIntersecting) cruzan.add(e.target); else cruzan.delete(e.target); });
        aplicar();
      }, { rootMargin: "-" + centro + "px 0px -" + abajo + "px 0px", threshold: 0 });
      secciones.forEach((s) => observer.observe(s));
    };
    observar();
    window.addEventListener("resize", observar);
    // Al volver a la pestaña, desde la caché de página (bfcache de iOS) o al rotar, el estado del header se recalcula
    window.addEventListener("pageshow", observar);
    window.addEventListener("orientationchange", observar);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) observar(); });
  }
  try { initHeaderTheme(); } catch (e) { /* mejora secundaria: no corta el resto del script */ }

  /* ============================================================
     HEADER LIQUID GLASS — mejora progresiva. html[data-glass="liquid"] solo en Chromium de
     escritorio (puntero fino, ≥900px, sin reduced-motion ni reduced-transparency, sin
     ?glass=off). Fuera de eso queda html[data-glass="simple"]: el vidrio simple en cápsula.
     El efecto es un filtro SVG (#lg-refract) usado como backdrop-filter: 3 feDisplacementMap
     (uno por canal, con escalas distintas) leen un mapa de desplazamiento que se dibuja en un
     canvas al tamaño real de la cápsula. No hay animación propia: solo reacciona al scroll
     del contenido que pasa por debajo.
     ============================================================ */
  function initHeaderGlass() {
    const root = document.documentElement;
    const header = document.querySelector(".site-header");
    if (!header) return;
    const param = new URLSearchParams(window.location.search).get("glass");
    const SVG_NS = "http://www.w3.org/2000/svg";
    let svg = null;
    let feImage = null;
    let ultimo = "";

    const esChromium = () => {
      const marcas = (navigator.userAgentData && navigator.userAgentData.brands) || [];
      return marcas.some((m) => /chromium/i.test(m.brand)) || !!window.chrome;
    };
    const mq = (q) => window.matchMedia(q).matches;
    const quiereLiquid = () =>
      GLASS_LIQUID_ENABLED && param !== "off" && esChromium() && window.innerWidth >= 900 &&
      mq("(hover: hover) and (pointer: fine)") &&
      !mq("(prefers-reduced-motion: reduce)") && !mq("(prefers-reduced-transparency: reduce)");

    // Mapa de desplazamiento: gris neutro (128,128) en el centro; en el bisel, desplazamiento
    // hacia adentro con perfil de lente convexa (pendiente de un squircle: crece hacia el borde).
    function mapaDeDesplazamiento(w, h) {
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      const img = ctx.createImageData(w, h);
      const d = img.data;
      const radio = h / 2; // cápsula
      const hw = w / 2;
      const hh = h / 2;
      const sd = (x, y) => { // distancia con signo al borde (negativa adentro)
        const qx = Math.abs(x - hw) - (hw - radio);
        const qy = Math.abs(y - hh) - (hh - radio);
        return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - radio;
      };
      const PENDIENTE_MAX = 3;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const px = x + 0.5;
          const py = y + 0.5;
          const prof = Math.max(-sd(px, py), 0); // profundidad desde el borde, en px
          let r = 128;
          let g = 128;
          if (prof < LG.bisel) {
            const u = Math.max(prof / LG.bisel, 0.0005);
            // altura de un squircle convexo h(u) = (1 − (1 − u)^4)^(1/4) y su pendiente
            const pendiente = Math.pow(1 - Math.pow(1 - u, 4), -0.75) * Math.pow(1 - u, 3);
            const m = Math.min(pendiente, PENDIENTE_MAX) / PENDIENTE_MAX;
            const e = 0.5;
            let gx = sd(px + e, py) - sd(px - e, py);
            let gy = sd(px, py + e) - sd(px, py - e);
            const largo = Math.hypot(gx, gy) || 1;
            gx /= largo;
            gy /= largo;
            r = 128 - gx * m * 127; // normal hacia adentro = −gradiente
            g = 128 - gy * m * 127;
          }
          const i = (y * w + x) * 4;
          d[i] = r; d[i + 1] = g; d[i + 2] = 128; d[i + 3] = 255;
        }
      }
      ctx.putImageData(img, 0, 0);
      return canvas.toDataURL("image/png");
    }

    const nodo = (tag, attrs) => {
      const n = document.createElementNS(SVG_NS, tag);
      Object.keys(attrs).forEach((k) => n.setAttribute(k, attrs[k]));
      return n;
    };

    function montarFiltro() {
      if (svg) return;
      svg = nodo("svg", { width: "0", height: "0", "aria-hidden": "true", focusable: "false" });
      svg.style.cssText = "position:absolute;width:0;height:0;overflow:hidden;pointer-events:none";
      const filtro = nodo("filter", { id: "lg-refract", "color-interpolation-filters": "sRGB", x: "0", y: "0", width: "100%", height: "100%" });
      feImage = nodo("feImage", { x: "0", y: "0", width: "1", height: "1", preserveAspectRatio: "none", result: "mapa" });
      filtro.append(feImage);
      // un desplazamiento por canal (escalas distintas) y cada resultado aislado a su canal
      const canales = [
        ["R", LG.escalaR, "1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0 1"],
        ["G", LG.escalaG, "0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 0 1"],
        ["B", LG.escalaB, "0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 0 1"]
      ];
      canales.forEach(([c, escala, matriz]) => {
        filtro.append(
          nodo("feDisplacementMap", { in: "SourceGraphic", in2: "mapa", scale: String(escala), xChannelSelector: "R", yChannelSelector: "G", result: "d" + c }),
          nodo("feColorMatrix", { in: "d" + c, type: "matrix", values: matriz, result: "c" + c })
        );
      });
      filtro.append(
        nodo("feBlend", { in: "cR", in2: "cG", mode: "screen", result: "rg" }),
        nodo("feBlend", { in: "rg", in2: "cB", mode: "screen", result: "rgb" })
      );
      svg.append(filtro);
      document.body.prepend(svg);
    }

    function actualizarMapa() {
      if (!svg) return;
      const caja = header.getBoundingClientRect();
      const w = Math.round(caja.width);
      const h = Math.round(caja.height);
      if (!w || !h || w + "x" + h === ultimo) return;
      ultimo = w + "x" + h;
      feImage.setAttribute("width", String(w));
      feImage.setAttribute("height", String(h));
      feImage.setAttribute("href", mapaDeDesplazamiento(w, h));
    }

    function aplicar() {
      const liquid = quiereLiquid();
      root.dataset.glass = liquid ? "liquid" : "simple";
      if (liquid) {
        montarFiltro();
        actualizarMapa();
      } else if (svg) {
        svg.remove();
        svg = null;
        feImage = null;
        ultimo = "";
      }
    }

    aplicar();
    let t = 0;
    window.addEventListener("resize", () => { clearTimeout(t); t = setTimeout(aplicar, 150); });
  }
  try { initHeaderGlass(); } catch (e) { /* mejora secundaria: un error aquí no corta el resto */ }

  /* ============================================================
     CARDS 3D — la card (producto o categoría) se inclina siguiendo el mouse: perspective +
     rotateX/rotateY de hasta ±TILT_MAX grados, scale(1.02), la imagen se desplaza hasta
     TILT_PARALLAX px en sentido contrario y un brillo radial sigue al cursor. Eventos
     delegados en los contenedores; un solo loop de requestAnimationFrame, activo solo
     mientras alguna card se mueve. Se apaga sin (hover: hover) y (pointer: fine), con
     prefers-reduced-motion, mientras se arrastra el carrusel y si la card tiene el foco
     por teclado (el aro de foco no se inclina).
     ============================================================ */
  function initCardTilt() {
    if (document.body.dataset.page !== "home") return; // el 3D es solo del Home
    const contenedores = document.querySelectorAll(".catalog-cards-row, .category-grid");
    if (!contenedores.length) return;
    const SEL = ".product-card, .category-tile";
    const TAU = 55; // ms: constante de suavizado (≈ 250 ms hasta asentarse)
    const habilitado = () =>
      window.matchMedia("(hover: hover) and (pointer: fine)").matches &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const estados = new Map(); // card → posición actual y objetivo
    let activa = null;
    let raf = 0;
    let ultimo = 0;

    const estadoDe = (card) => {
      let s = estados.get(card);
      if (!s) {
        // un solo brillo por card, reutilizado: limpiar() nunca lo borra ni se vuelve a crear
        if (!card.querySelector(":scope > .tilt-glare")) {
          const glare = document.createElement("span");
          glare.className = "tilt-glare";
          glare.setAttribute("aria-hidden", "true");
          card.append(glare);
        }
        s = { rx: 0, ry: 0, sc: 1, px: 0, py: 0, gx: 50, gy: 50, trx: 0, try_: 0, tsc: 1, tpx: 0, tpy: 0, tgx: 50, tgy: 50 };
        estados.set(card, s);
      }
      return s;
    };

    const aplicar = (card, s) => {
      card.style.transform = "perspective(1200px) rotateX(" + s.rx.toFixed(3) + "deg) rotateY(" + s.ry.toFixed(3) + "deg) scale(" + s.sc.toFixed(4) + ")";
      card.style.setProperty("--px", s.px.toFixed(2) + "px");
      card.style.setProperty("--py", s.py.toFixed(2) + "px");
      card.style.setProperty("--gx", s.gx.toFixed(1) + "%");
      card.style.setProperty("--gy", s.gy.toFixed(1) + "%");
    };
    const limpiar = (card) => {
      card.style.transform = "";
      ["--px", "--py", "--gx", "--gy"].forEach((v) => card.style.removeProperty(v));
      card.classList.remove("is-tilting");
      estados.delete(card);
    };

    const tick = (t) => {
      const dt = Math.min(t - ultimo, 50);
      ultimo = t;
      const k = 1 - Math.exp(-dt / TAU);
      estados.forEach((s, card) => {
        s.rx += (s.trx - s.rx) * k;
        s.ry += (s.try_ - s.ry) * k;
        s.sc += (s.tsc - s.sc) * k;
        s.px += (s.tpx - s.px) * k;
        s.py += (s.tpy - s.py) * k;
        s.gx += (s.tgx - s.gx) * k;
        s.gy += (s.tgy - s.gy) * k;
        const enReposo = card !== activa &&
          Math.abs(s.rx) < 0.01 && Math.abs(s.ry) < 0.01 && Math.abs(s.sc - 1) < 0.0005 && Math.abs(s.px) < 0.05 && Math.abs(s.py) < 0.05;
        if (enReposo) limpiar(card); else aplicar(card, s);
      });
      raf = estados.size ? requestAnimationFrame(tick) : 0;
    };
    const arrancar = () => { if (!raf) { ultimo = performance.now(); raf = requestAnimationFrame(tick); } };

    // Al agarrar el carrusel para arrastrar, la card vuelve a 0 de golpe (sin animación)
    const soltarYa = () => {
      if (!activa) return;
      const card = activa;
      card.classList.remove("is-tilt-hover");
      activa = null;
      limpiar(card);
    };
    const soltar = () => {
      if (!activa) return;
      const s = estados.get(activa);
      if (s) { s.trx = 0; s.try_ = 0; s.tsc = 1; s.tpx = 0; s.tpy = 0; }
      activa.classList.remove("is-tilt-hover");
      activa = null;
      arrancar(); // sigue el loop hasta que vuelva a 0
    };

    contenedores.forEach((cont) => {
      cont.addEventListener("pointermove", (e) => {
        if (e.pointerType !== "mouse") return;
        if (!habilitado() || e.buttons || cont.classList.contains("is-dragging")) { soltar(); return; }
        const card = e.target.closest(SEL);
        if (!card || !cont.contains(card) || card.classList.contains("is-gift-card") || card.matches(":focus-visible") || card.querySelector(":focus-visible")) { soltar(); return; }
        if (card !== activa) {
          soltar();
          activa = card;
          estadoDe(card);
          card.classList.add("is-tilting", "is-tilt-hover");
        }
        const r = card.getBoundingClientRect();
        const cx = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1));
        const cy = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height) * 2 - 1));
        const s = estadoDe(card);
        s.trx = -cy * TILT_MAX;        // el borde cercano al cursor se hunde
        s.try_ = cx * TILT_MAX;
        s.tsc = 1.02;
        s.tpx = -cx * TILT_PARALLAX;   // la imagen se mueve en sentido contrario al cursor
        s.tpy = -cy * TILT_PARALLAX;
        s.tgx = (cx + 1) * 50;
        s.tgy = (cy + 1) * 50;
        arrancar();
      });
      cont.addEventListener("pointerleave", soltar);
      cont.addEventListener("pointerdown", (e) => { if (e.pointerType === "mouse" && e.target.closest(".catalog-cards-row") && !e.target.closest(".gift-overlay")) soltarYa(); });
      cont.addEventListener("focusin", (e) => { if (activa && e.target.matches(":focus-visible")) soltar(); });
    });
    window.addEventListener("blur", soltar);
  }
  try { initCardTilt(); } catch (e) { /* mejora secundaria: un error aquí no corta el resto */ }

  /* ============================================================
     PANEL «CATÁLOGO» — en escritorio, un panel de vidrio bajo el header con las líneas de
     iPhone, AirPods y las subcategorías de Accesorios (todo generado desde los datos) y el
     resto de la página atenuada; en mobile, un acordeón dentro del menú. Mejora progresiva:
     sin datos (p. ej. la página 404) el item queda como un link a catalogo.html.
     Abre con click, Enter/Espacio o hover (120 ms); cierra con Escape, click en el fondo,
     al salir el foco del panel o al cambiar a mobile. Sin trampas de foco.
     ============================================================ */
  function initNavCatalogo() {
    const enlace = document.querySelector('.main-nav > ul > li > a[href$="catalogo.html"]');
    if (!enlace || typeof CATALOGO_DESTACADO === "undefined") return;
    const li = enlace.closest("li");
    const base = enlace.getAttribute("href");
    const root = document.documentElement;
    const url = (params) => base + "?" + Object.keys(params).map((k) => k + "=" + encodeURIComponent(params[k])).join("&");
    const el = (tag, attrs = {}, ...hijos) => {
      const n = document.createElement(tag);
      Object.keys(attrs).forEach((k) => { if (k === "text") n.textContent = attrs[k]; else n.setAttribute(k, attrs[k]); });
      hijos.forEach((h) => h && n.append(h));
      return n;
    };

    // --- datos: líneas de modelos únicas (de la más nueva a la más vieja, como están en los datos)
    const lineas = (cat) => {
      const vistos = new Set();
      CATALOGO_DESTACADO.filter((p) => p.categoria === cat).forEach((p) => vistos.add(p.nombre.replace(/\s+(Pro Max|Pro|Plus|Max|mini)$/i, "")));
      return [...vistos];
    };
    const subcategorias = typeof ACCESORIOS_BASE !== "undefined" ? [...new Set(ACCESORIOS_BASE.map((f) => f[0]))] : [];
    const columnas = [];
    [["iPhone", lineas("iPhone"), (n) => ({ cat: "iPhone", q: n })], ["AirPods", lineas("AirPods"), (n) => ({ cat: "AirPods", q: n })]].forEach(([titulo, items, params]) => {
      if (items.length) columnas.push({ titulo, href: url({ cat: titulo }), items: items.map((n) => ({ texto: n, href: url(params(n)) })) });
    });
    if (subcategorias.length) columnas.push({ titulo: "Accesorios", href: url({ cat: "Accesorios" }), items: subcategorias.map((s) => ({ texto: s, href: url({ cat: "Accesorios", sub: s }) })) });
    if (!columnas.length) return;

    // --- DOM
    const boton = el("button", { type: "button", class: "nav-link nav-trigger" + (enlace.classList.contains("is-active") ? " is-active" : ""), "aria-expanded": "false", "aria-controls": "panel-catalogo" });
    boton.append(document.createTextNode(enlace.textContent.trim()));
    boton.insertAdjacentHTML("beforeend", '<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 4.5 6 8.5l4-4"></path></svg>');
    const panel = el("div", { id: "panel-catalogo", class: "nav-panel" });
    panel.style.setProperty("--nav-cols", String(columnas.length + 1));
    columnas.forEach((col) => {
      panel.append(el("div", { class: "nav-panel-col" },
        el("a", { class: "nav-panel-heading", href: col.href, text: col.titulo }),
        el("ul", { class: "nav-panel-links" }, ...col.items.map((it) => el("li", {}, el("a", { href: it.href, text: it.texto }))))));
    });
    panel.append(el("a", { class: "nav-panel-all", href: base, text: "Ver todo el catálogo →" }));
    li.classList.add("nav-item");
    li.replaceChildren(boton, panel);
    const scrim = el("div", { class: "nav-scrim", "aria-hidden": "true" });
    document.body.append(scrim);

    // --- estado
    const escritorio = () => window.matchMedia("(min-width: 900px)").matches;
    const conMouse = () => escritorio() && window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    let fijo = false;          // abierto por click/teclado (no se cierra al sacar el mouse)
    let mouseAdentro = false;
    let tAbrir = 0;
    let tCerrar = 0;
    const abierto = () => li.classList.contains("is-open");

    const bloquear = () => {
      root.style.setProperty("--sbw", (window.innerWidth - root.clientWidth) + "px");
      root.classList.add("nav-panel-open");
    };
    const desbloquear = () => { root.classList.remove("nav-panel-open"); root.style.removeProperty("--sbw"); };

    function abrir(esFijo) {
      clearTimeout(tCerrar);
      if (abierto()) { if (esFijo) fijo = true; return; }
      fijo = !!esFijo;
      if (escritorio()) { bloquear(); scrim.classList.add("is-open"); }
      li.classList.add("is-open");
      boton.setAttribute("aria-expanded", "true");
    }
    function cerrar(devolverFoco) {
      clearTimeout(tAbrir);
      clearTimeout(tCerrar);
      if (!abierto()) return;
      li.classList.remove("is-open");
      boton.setAttribute("aria-expanded", "false");
      scrim.classList.remove("is-open");
      desbloquear();
      fijo = false;
      if (devolverFoco) boton.focus();
    }

    boton.addEventListener("click", () => {
      if (!escritorio()) { if (abierto()) cerrar(false); else abrir(true); return; }
      if (abierto() && !fijo) { fijo = true; return; } // abierto por hover: el click lo deja fijo
      if (abierto()) cerrar(false); else abrir(true);
    });
    li.addEventListener("pointerenter", (e) => {
      if (e.pointerType !== "mouse" || !conMouse()) return;
      mouseAdentro = true;
      clearTimeout(tCerrar);
      if (!abierto()) tAbrir = setTimeout(() => abrir(false), 120);
    });
    li.addEventListener("pointerleave", (e) => {
      if (e.pointerType !== "mouse") return;
      mouseAdentro = false;
      clearTimeout(tAbrir);
      if (abierto() && !fijo && conMouse()) tCerrar = setTimeout(() => cerrar(false), 160);
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && abierto() && escritorio()) { e.preventDefault(); cerrar(true); }
    });
    scrim.addEventListener("click", () => cerrar(false));
    li.addEventListener("focusout", () => {
      setTimeout(() => {
        if (abierto() && escritorio() && !li.contains(document.activeElement) && !mouseAdentro) cerrar(false);
      }, 0);
    });
    panel.addEventListener("click", (e) => {
      if (!e.target.closest("a")) return;
      cerrar(false);
      const toggle = document.querySelector(".nav-toggle");
      if (!escritorio() && toggle && toggle.getAttribute("aria-expanded") === "true") toggle.click(); // cierra el menú mobile
    });
    window.addEventListener("resize", () => { if (abierto()) cerrar(false); });
  }
  try { initNavCatalogo(); } catch (e) { /* mejora secundaria: un error aquí no corta el resto */ }

  /* ============================================================
     DETALLE DE PRODUCTO — <dialog> modal que se abre al tocar una card (Home y catálogo).
     Todo sale de los datos (products-data.js y, si está cargado, accesorios-data.js): solo se
     muestra lo que existe. showModal da el foco atrapado y el Escape; el fondo cierra con click.
     URL compartible: #producto={id}. Escritorio sin animaciones; móvil (≤699px): hoja inferior animada.
     Secciones desplegables (acordeón) solo con datos reales; Plan Canje siempre.
     ============================================================ */
  function initDetalleProducto() {
    const productos = [...(typeof CATALOGO_DESTACADO !== "undefined" ? CATALOGO_DESTACADO : []), ...expandirAccesorios()];
    // las cards se renderizan más abajo en este mismo archivo: acá solo se comprueba que la página tenga el contenedor
    if (!productos.length || !document.querySelector(".catalog-cards-row, .catalog-grid-full")) return;
    const porId = new Map(productos.map((p) => [p.id, p]));
    const root = document.documentElement;
    const APPLE_COMPARAR = "https://www.apple.com/la/iphone/compare/";
    let dialogo = null;
    let cerrarDetalle = () => {};
    let producto = null;
    let color = 0;
    let foto = 0; // foto activa de la galería (productos con fotos propias)
    let abiertas = null; // ids de las secciones desplegadas (null = todavía sin decidir para este producto)

    const el = (tag, attrs = {}, ...hijos) => {
      const n = document.createElement(tag);
      Object.keys(attrs).forEach((k) => { if (k === "text") n.textContent = attrs[k]; else if (attrs[k] !== false) n.setAttribute(k, attrs[k]); });
      hijos.flat().forEach((h) => h && n.append(h));
      return n;
    };
    const SVG_CERRAR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"></path></svg>';

    // Variante con el color activo: «Negro · 256GB» pasa a «Plateado · 256GB» al elegir Plateado
    const varianteActiva = () => varianteDe(producto, color);

    const SVG_CHEVRON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"></path></svg>';
    const texto = (v) => typeof v === "string" && v.trim() !== "";

    // Secciones con datos reales de un producto (la de Plan Canje se arma aparte: es fija)
    function seccionesDe(p) {
      const out = [];
      const ficha = Array.isArray(p.ficha) ? p.ficha.filter((f) => f && texto(f.rotulo) && texto(f.valor)) : [];
      const detalles = Array.isArray(p.detalles) ? p.detalles.filter(texto) : [];
      if (ficha.length || texto(p.especificacion) || texto(p.descripcion) || detalles.length) {
        out.push({ id: "caracteristicas", titulo: "Características", nodos: [
          ficha.length ? el("dl", { class: "pd-ficha" }, ficha.map((f) => [el("dt", { text: f.rotulo }), el("dd", { text: f.valor })]).flat()) : null,
          texto(p.especificacion) ? el("p", { class: "pd-texto", text: p.especificacion }) : null,
          texto(p.descripcion) ? el("p", { class: "pd-texto", text: p.descripcion }) : null,
          detalles.length ? el("ul", { class: "pd-lista" }, detalles.map((t) => el("li", { text: t }))) : null
        ] });
      }
      if (esUsado(p)) {
        const bat = bateriaDe(p);
        if (bat !== null || texto(p.estado) || texto(p.estadoDetalle)) {
          out.push({ id: "estado", titulo: "Estado y batería", nodos: [
            bat !== null ? el("div", { class: "pd-bateria" },
              el("div", { class: "pd-bateria-fila" }, el("span", { text: "Salud de batería" }), el("strong", { text: bat + "%" })),
              el("div", { class: "pd-barra", role: "img", "aria-label": "Salud de batería " + bat + "%" }, el("span", { class: "pd-barra-relleno", style: "width:" + bat + "%" }))) : null,
            texto(p.estado) ? el("p", { class: "pd-texto" }, "Estado: ", el("strong", { text: p.estado })) : null,
            texto(p.estadoDetalle) ? el("p", { class: "pd-texto", text: p.estadoDetalle }) : null
          ] });
        }
      }
      const g = p.garantia || {};
      if (texto(g.duracion) || texto(g.cobertura)) {
        out.push({ id: "garantia", titulo: "Garantía", nodos: [
          el("dl", { class: "pd-ficha" }, [
            texto(g.duracion) ? [el("dt", { text: "Duración" }), el("dd", { text: g.duracion })] : null,
            texto(g.cobertura) ? [el("dt", { text: "Cobertura" }), el("dd", { text: g.cobertura })] : null
          ].filter(Boolean).flat())
        ] });
      }
      const incluye = Array.isArray(p.incluye) ? p.incluye.filter(texto) : [];
      if (incluye.length) out.push({ id: "incluye", titulo: "Qué incluye", nodos: [el("ul", { class: "pd-lista" }, incluye.map((t) => el("li", { text: t })))] });
      return out;
    }

    // Contenido fijo de Plan Canje (+ formas de pago solo si SITE_CONFIG.formasPago existe)
    function nodosPlanCanje() {
      const pago = typeof SITE_CONFIG !== "undefined" && texto(SITE_CONFIG.formasPago) ? SITE_CONFIG.formasPago : "";
      return [
        el("p", { class: "pd-texto" }, "Aceptamos tu equipo como parte de pago. ", el("a", { class: "pd-enlace", href: "plan-canje.html#calculadora", text: "Calculá su valor →" })),
        pago ? el("p", { class: "pd-texto", text: pago }) : null
      ];
    }

    // Bloque «Promo vigente» (solo si alguna promo vigente alcanza al producto)
    function bloquePromo(p) {
      const pr = typeof promosDe === "function" ? promosDe(p)[0] : null;
      if (!pr) return null;
      const regalos = (pr.regalos || []).filter(Boolean);
      return el("div", { class: "pd-promo" },
        el("p", { class: "pd-promo-rotulo", text: "Promo vigente" }),
        texto(pr.titulo) ? el("p", { class: "pd-promo-titulo", text: pr.titulo }) : null,
        regalos.length ? el("ul", { class: "pd-lista" }, regalos.map((t) => el("li", { text: t }))) : null,
        texto(pr.condiciones) ? el("p", { class: "pd-texto", text: pr.condiciones }) : null,
        pr.fin ? el("p", { class: "pd-texto", text: "Válido hasta " + fechaLegible(pr.fin) }) : null);
    }

    function acordeon(p) {
      const secs = seccionesDe(p);
      if (!secs.length) return el("div", { class: "pd-fila-canje" }, nodosPlanCanje()); // solo la fila fija, sin acordeón
      secs.push({ id: "canje", titulo: "Formas de pago y Plan Canje", nodos: nodosPlanCanje() });
      if (abiertas === null) abiertas = new Set([secs[0].id]); // la primera con datos, abierta
      return el("div", { class: "pd-acordeon" }, secs.map((sec) => {
        const abierta = abiertas.has(sec.id);
        const btn = el("button", { type: "button", class: "pd-seccion-btn", id: "pd-btn-" + sec.id, "aria-expanded": String(abierta), "aria-controls": "pd-panel-" + sec.id, "data-sec": sec.id }, el("span", { text: sec.titulo }));
        btn.insertAdjacentHTML("beforeend", SVG_CHEVRON);
        const panel = el("div", { class: "pd-panel", id: "pd-panel-" + sec.id, role: "region", "aria-labelledby": "pd-btn-" + sec.id, inert: abierta ? false : "" },
          el("div", { class: "pd-panel-recorte" }, el("div", { class: "pd-panel-contenido" }, sec.nodos)));
        return el("div", { class: "pd-seccion" + (abierta ? " is-open" : "") }, el("h3", { class: "pd-seccion-titulo" }, btn), panel);
      }));
    }

    function pintar() {
      const p = producto;
      const cs = p.colores || [];
      const variante = varianteActiva();
      const pr = precioDe(p);
      const media = dialogo.querySelector(".product-dialog-media");
      media.replaceChildren();
      const fotos = fotosDe(p);
      if (fotos.length) {
        media.append(el("img", { src: fotos[foto] || fotos[0], alt: p.nombre, width: "728", height: "666", loading: "lazy", decoding: "async" }));
        if (fotos.length > 1) {
          media.append(el("div", { class: "product-dialog-thumbs", role: "group", "aria-label": "Fotos del producto" }, fotos.map((u, i) =>
            el("button", { type: "button", class: "pd-thumb" + (i === foto ? " is-active" : ""), "aria-label": "Foto " + (i + 1) + " de " + fotos.length, "aria-pressed": String(i === foto), "data-foto": String(i) },
              el("img", { src: u, alt: "", width: "56", height: "56", loading: "lazy", decoding: "async" })))));
        }
      } else if (cs.length && colorImg(p, color)) {
        media.append(el("img", { src: colorImg(p, color), alt: p.categoria === "Accesorios" ? p.nombre : p.nombre + " color " + cs[color].nombre.toLowerCase(), width: "728", height: "666", decoding: "async" }));
      } else {
        const ph = el("div", { class: "product-card-media-placeholder" });
        ph.innerHTML = (p.categoria === "iPhone" ? ICONO_TELEFONO : ICONO_CAJA) + "<span>Foto próximamente</span>";
        media.append(ph);
      }
      const info = dialogo.querySelector(".product-dialog-info");
      info.replaceChildren(...[
        esUsado(p)
          ? el("div", { class: "product-dialog-etiquetas" }, el("span", { class: "pd-etiqueta pd-etiqueta--usado", text: "Usado" }), el("span", { class: "pd-etiqueta", text: "Unidad única" }))
          : el("span", { class: "product-card-eyebrow" + (p.nuevo === true ? " is-new" : ""), text: p.nuevo === true ? "Nuevo" : p.subcategoria || p.categoria }),
        el("h2", { id: "product-dialog-titulo", class: "title-sentence", text: p.nombre }),
        variante ? el("p", { class: "product-dialog-variante", text: variante }) : null,
        cs.length > 1 ? el("div", { class: "product-dialog-colores" },
          el("p", { class: "product-dialog-color-nombre" }, "Color: ", el("strong", { text: cs[color].nombre })),
          el("div", { class: "color-swatches", role: "group", "aria-label": "Colores disponibles" }, cs.map((c, i) =>
            el("button", { type: "button", class: "color-swatch" + (i === color ? " is-active" : ""), style: "--swatch: " + c.hex, "aria-label": c.nombre, "aria-pressed": String(i === color), title: c.nombre, "data-i": String(i) })))) : null,
        el("p", { class: "product-card-price product-dialog-precio" }, pr.desde ? el("small", { text: pr.desde }) : null, el("strong", { text: pr.texto })),
        bloquePromo(p),
        el("div", { class: "product-dialog-acciones" },
          el("button", Object.assign({ type: "button", class: "btn btn-primary", "data-add": p.id, "data-c": String(color) }, esUsado(p) ? { "data-usado": "" } : {}), el("span", { class: "add-txt", text: "Agregar a mi pedido" })),
          el("a", { class: "btn btn-outline", href: "https://wa.me/" + SITE_CONFIG.whatsappNumber + "?text=" + encodeURIComponent(mensajeProducto(p, variante)), target: "_blank", rel: "noopener", text: "Consultar por WhatsApp" })),
        p.categoria === "iPhone" ? el("a", { class: "product-dialog-apple", href: APPLE_COMPARAR, target: "_blank", rel: "noopener noreferrer", text: "Comparar modelos en el sitio de Apple ↗" }) : null,
        acordeon(p)
      ].filter(Boolean)); // replaceChildren convierte null en el texto "null"
      if (window.Pedido) window.Pedido.marcar(); // el usado que ya está en el pedido muestra «En tu pedido»
    }

    function crear() {
      dialogo = el("dialog", { class: "product-dialog", "aria-labelledby": "product-dialog-titulo", tabindex: "-1" },
        el("div", { class: "product-dialog-body" },
          el("button", { type: "button", class: "product-dialog-close", "aria-label": "Cerrar detalle" }),
          el("div", { class: "product-dialog-media" }),
          el("div", { class: "product-dialog-info" })));
      dialogo.querySelector(".product-dialog-close").innerHTML = SVG_CERRAR;
      // Cierre: en celular (≤640px) la tarjeta se anima antes de cerrar; en escritorio se cierra al instante
      let cerrando = false;
      cerrarDetalle = () => {
        if (!dialogo.open || cerrando) return; // evita el doble cierre
        if (!matchMedia("(max-width: 640px)").matches) { dialogo.close(); return; }
        cerrando = true;
        dialogo.classList.add("is-closing");
        let hecho = false;
        const fin = () => { if (hecho) return; hecho = true; cerrando = false; dialogo.classList.remove("is-closing"); if (dialogo.open) dialogo.close(); };
        dialogo.addEventListener("animationend", (e) => { if (e.target === dialogo) fin(); });
        setTimeout(fin, 300); // respaldo
      };
      dialogo.querySelector(".product-dialog-close").addEventListener("click", cerrarDetalle);
      dialogo.addEventListener("cancel", (e) => { if (matchMedia("(max-width: 640px)").matches) { e.preventDefault(); cerrarDetalle(); } }); // Esc
      // click en el fondo (::backdrop): solo si el toque empezó y terminó ahí (arrastrar el scroll interno no cierra)
      let bajoFondo = false;
      dialogo.addEventListener("pointerdown", (e) => { bajoFondo = e.target === dialogo; });
      dialogo.addEventListener("click", (e) => { if (e.target === dialogo && bajoFondo) cerrarDetalle(); });
      dialogo.addEventListener("click", (e) => {
        const sw = e.target.closest(".color-swatch");
        if (!sw) return;
        color = Number(sw.dataset.i);
        pintar();
        dialogo.querySelector('.color-swatch[aria-pressed="true"]').focus(); // el foco no se pierde al redibujar
      });
      dialogo.addEventListener("click", (e) => { // miniaturas de la galería
        const th = e.target.closest(".pd-thumb");
        if (!th) return;
        foto = Number(th.dataset.foto);
        pintar();
        dialogo.querySelector('.pd-thumb[aria-pressed="true"]').focus();
      });
      dialogo.addEventListener("click", (e) => { // acordeón: varias secciones pueden quedar abiertas
        const btn = e.target.closest(".pd-seccion-btn");
        if (!btn) return;
        const abierta = btn.getAttribute("aria-expanded") !== "true";
        btn.setAttribute("aria-expanded", String(abierta));
        const sec = btn.closest(".pd-seccion");
        sec.classList.toggle("is-open", abierta);
        sec.querySelector(".pd-panel").inert = !abierta;
        if (abierta) abiertas.add(btn.dataset.sec); else abiertas.delete(btn.dataset.sec);
      });
      dialogo.addEventListener("close", () => {
        root.classList.remove("dialog-open");
        root.style.removeProperty("--sbw");
        if (/^#producto=/.test(location.hash)) history.replaceState(null, "", location.pathname + location.search);
        const id = producto && producto.id;
        const card = id && document.querySelector('.product-card[data-id="' + id + '"]');
        const opener = card && card.querySelector(".product-card-open");
        if (opener && card.style.display !== "none") opener.focus(); // el foco vuelve a la card
        producto = null;
      });
      document.body.append(dialogo);
    }

    function abrir(id) {
      const p = porId.get(id);
      if (!p) return;
      if (!dialogo) crear();
      producto = p;
      color = 0;
      foto = 0;
      abiertas = null;
      pintar();
      if (!dialogo.open) {
        root.style.setProperty("--sbw", (window.innerWidth - root.clientWidth) + "px");
        root.classList.add("dialog-open");
        dialogo.showModal();
        dialogo.focus({ preventScroll: true }); // foco inicial en el diálogo: la X no muestra aro al abrir (con Tab sí)
      }
      history.replaceState(null, "", location.pathname + location.search + "#producto=" + encodeURIComponent(id));
    }

    // Click en cualquier parte de la card (el botón invisible la cubre), salvo «Consultar» y los puntos de color
    document.addEventListener("click", (e) => {
      const abridor = e.target.closest(".product-card-open");
      if (!abridor) return;
      const card = abridor.closest(".product-card");
      if (card) abrir(card.dataset.id);
    });
    const desdeHash = () => {
      const m = /^#producto=(.+)$/.exec(location.hash);
      if (m) abrir(decodeURIComponent(m[1]));
      else if (dialogo && dialogo.open) dialogo.close();
    };
    window.addEventListener("hashchange", desdeHash);
    desdeHash();
  }
  try { initDetalleProducto(); } catch (e) { /* mejora secundaria: un error aquí no corta el resto */ }

  /* ============================================================
     WHATSAPP — todos los links [data-wa] se arman acá con el número de
     js/config.js. El href del HTML es solo un respaldo sin mensaje.
     ============================================================ */
  function applyWhatsAppLinks(root = document) {
    if (typeof SITE_CONFIG === "undefined") return;
    root.querySelectorAll("[data-wa]").forEach((a) => {
      const text = a.dataset.wa;
      a.href = "https://wa.me/" + SITE_CONFIG.whatsappNumber + (text ? "?text=" + encodeURIComponent(text) : "");
    });
  }

  /* ============================================================
     CATÁLOGO — render de cards desde products-data.js
     Compartido entre el carrusel .catalog-cards-row del Home y el
     .catalog-grid-full de catalogo.html — misma data, mismo template.
     ============================================================ */
  // Sin mayúsculas ni tildes (NFD), para el buscador
  function normalizar(t) { return String(t).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(); }

  // js/accesorios-data.js → objetos con el mismo formato que CATALOGO_DESTACADO (solo catalogo.html lo carga)
  function expandirAccesorios() {
    if (typeof ACCESORIOS_BASE === "undefined") return [];
    const usados = new Set();
    // cuarto valor opcional de cada fila = ruta de la foto (WebP con fondo transparente)
    return ACCESORIOS_BASE.map(([subcategoria, nombre, precioNum, foto, fotos, regalo, moneda]) => {
      const base = normalizar(nombre).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      let id = base;
      for (let n = 2; usados.has(id); n++) id = base + "-" + n;
      usados.add(id);
      return { id, categoria: "Accesorios", subcategoria, nombre, variante: "", especificacion: "", precioNum: Number.isFinite(precioNum) ? precioNum : null, moneda: moneda === "USD" ? "USD" : "ARS", colores: foto ? [{ nombre: "Único", hex: "#FFFFFF", imagen: foto }] : [], disponible: true, fotos: Array.isArray(fotos) ? fotos : [], ...(typeof regalo === "boolean" ? { regalo } : {}) };
    });
  }

  // Fotos propias (Supabase): mandan con 0 o 1 color, o con 2+ colores donde ninguno tiene imagen (galería; los colores no cambian la foto).
  // productos-api.js ya las deja con la principal (o la primera) al frente.
  const fotosDe = (p) => { const cs = p.colores || []; return Array.isArray(p.fotos) && p.fotos.length && (cs.length < 2 || !cs.some((c) => c && c.imagen)) ? p.fotos : []; };
  // Imagen de un color: la suya; si no tiene, la foto principal; si tampoco hay, la de otro color. Sin colores: "" (se usa fotosDe).
  function colorImg(p, i) {
    const cs = p.colores || [];
    if (!cs.length) return "";
    const c = cs[i] || cs[0];
    if (c && c.imagen) return c.imagen;
    return (Array.isArray(p.fotos) && p.fotos[0]) || (cs.find((x) => x && x.imagen) || {}).imagen || "";
  }

  function escAttr(t) { return String(t).replace(/&/g, "&amp;").replace(/"/g, "&quot;"); }
  // Fotos locales «*-t.webp» tienen una versión de 400px (*-t-400.webp): el navegador elige según el ancho de la card. Las demás (Supabase, etc.) van sin srcset.
  const SRCSET_SIZES = "(max-width: 559px) 64vw, 300px";
  function srcsetDe(src) {
    const m = /^(assets\/img\/.+)-t\.webp$/.exec(src || "");
    if (m) return m[1] + "-t-400.webp 400w, " + src + " 800w";
    // Fotos de iPhone cargadas por modelo/color («iphone-15-pro-azul.webp»): la chica es «iphone-15-pro-azul-400.webp»
    const n = /^(assets\/img\/iphone-\d+[a-z0-9-]*)\.webp$/.exec(src || "");
    return n ? n[1] + "-400.webp 400w, " + src + " 800w" : "";
  }
  function srcsetAttr(src) { const ss = srcsetDe(src); return ss ? ` srcset="${escAttr(ss)}" sizes="${SRCSET_SIZES}"` : ""; }

  // Precio visible de un producto: { desde, texto }. Accesorios: el precio guardado (precioNum) solo se
  // imprime con ACCESORIOS_CONFIG.mostrarPrecio === true; en cualquier otro caso, «Consultar».
  // El formato de precios es único: formatearPrecio(valor, moneda) vive en js/config.js («$1.850.000» / «US$ 1.200»).
  const esUsado = (p) => p.condicion === "usado";
  const bateriaDe = (p) => (esUsado(p) && Number.isInteger(p.bateria) && p.bateria >= 0 && p.bateria <= 100 ? p.bateria : null);
  const ICONO_BATERIA = `<svg class="icono-bateria" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="7" width="17" height="10" rx="2.5"></rect><path d="M22 10.5v3"></path></svg>`;
  // Variante con el color elegido: «Negro · 256GB» pasa a «Plateado · 256GB» al elegir Plateado
  function varianteDe(p, color) {
    const cs = p.colores || [];
    if (cs.length < 2 || !p.variante) return p.variante || "";
    const c = cs[color] || cs[0];
    return p.variante.includes(cs[0].nombre) ? p.variante.replace(cs[0].nombre, c.nombre) : p.variante + " · " + c.nombre;
  }
  function precioDe(p) {
    const ok = Number.isFinite(p.precioNum) && p.precioNum > 0; // null o 0 → «Consultar» / el texto de p.precio
    const mon = p.moneda === "USD" ? "USD" : "ARS";
    if (p.categoria === "Accesorios") {
      const visible = typeof ACCESORIOS_CONFIG !== "undefined" && ACCESORIOS_CONFIG.mostrarPrecio === true && ok;
      return { desde: null, texto: visible ? formatearPrecio(p.precioNum, mon) : "Consultar" };
    }
    if (p.moneda && ok) return { desde: /^Desde\s/i.test(String(p.precio)) ? "Desde" : null, texto: formatearPrecio(p.precioNum, mon) };
    if (p.precio == null) return { desde: null, texto: "Consultar" };
    const m = String(p.precio).match(/^(Desde)\s+(.+)$/i);
    return m ? { desde: m[1], texto: m[2] } : { desde: null, texto: String(p.precio) };
  }
  function mensajeProducto(p, variante) {
    if (p.categoria === "Accesorios") return "Hola, quiero consultar por " + p.nombre;
    const b = bateriaDe(p);
    return "Hola, me interesa el " + p.nombre + " · " + variante + (esUsado(p) ? " (usado" + (b !== null ? ", batería " + b + "%" : "") + ")" : "");
  }

  const ICONO_TELEFONO = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="7" y="2" width="10" height="20" rx="2.2"></rect><line x1="11" y1="18" x2="13" y2="18"></line></svg>`;
  const ICONO_REGALO = `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="9" width="17" height="11" rx="1.5"></rect><path d="M12 9v11M2.5 9h19M12 9C9.5 9 8 8 8 6.5S9.5 4 12 9zM12 9c2.5 0 4-1 4-2.5S14.5 4 12 9z"></path></svg>`;
  const ICONO_MAS = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"></path></svg>`;
  const ICONO_CAJA = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z"></path><path d="M3 7.5 12 12l9-4.5M12 12v9"></path></svg>`;

  /* Listón de regalo (esquina superior derecha) + panel con los regalos sobre la foto. Los regalos salen de la promo vigente
     (js/promos-data.js → regalos): solo las cards con promo con regalos los llevan. */
  // Panel «Incluye de regalo» (mockup aprobado): los tres regalos, sus textos y sus íconos son fijos.
  const GIFT_SVG_ATTR = 'width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"';
  const GIFT_ITEMS = [
    { titulo: 'Cable <span class="gift-nb">USB-C</span>', sub: "Carga rápida trenzado", svg: '<path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z"></path>' },
    { titulo: "Funda protectora", sub: "Silicona / MagSafe", svg: '<rect x="6" y="2" width="12" height="20" rx="3"></rect><circle cx="12" cy="13" r="3"></circle><line x1="12" y1="16" x2="12" y2="18.5"></line><rect x="8.5" y="4.5" width="3.5" height="3.5" rx="1"></rect>' },
    { titulo: "Vidrio templado", sub: "Protección 9H HD", svg: '<rect x="6" y="2" width="12" height="20" rx="2.5"></rect><line x1="9" y1="7" x2="13" y2="11"></line><line x1="11" y1="6" x2="15" y2="10"></line>' }
  ];
  function giftOverlayHTML(id) {
    return `<div class="gift-overlay" id="${id}" role="group" aria-label="Incluye de regalo" aria-hidden="true" inert>
        <div class="gift-head">
          <span class="gift-badge"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true" focusable="false"><polyline points="20 12 20 22 4 22 4 12"></polyline><rect x="2" y="7" width="20" height="5"></rect><line x1="12" y1="22" x2="12" y2="7"></line></svg>Incluye de regalo</span>
          <button type="button" class="gift-overlay-close" aria-label="Cerrar" title="Cerrar">✕</button>
        </div>
        <div class="gift-list">${GIFT_ITEMS.map((g) => `<div class="gift-item">
          <div class="gift-item-main"><div class="gift-item-icon"><svg ${GIFT_SVG_ATTR}>${g.svg}</svg></div><div class="gift-item-text"><div class="gift-item-title">${g.titulo}</div><div class="gift-item-sub">${g.sub}</div></div></div>
          <span class="gift-item-tag">GRATIS</span>
        </div>`).join("")}</div>
      </div>`;
  }
  /* Apertura y cierre del panel de regalo. La card crece lo necesario para que entre todo el panel, con 14px fijos entre el
     panel y el bloque del precio (GIFT_GAP). Se anima solo altura, opacidad y translateY (CSS); las alturas se miden acá
     porque el panel está en posición absoluta. Cerrado: inert + aria-hidden (sin foco ni lectura). Con prefers-reduced-motion
     el cambio es instantáneo. Solo crece la card abierta: las demás de la fila se congelan en su alto actual. */
  const GIFT_GAP = 14, GIFT_MS_IN = 330, GIFT_MS_OUT = 250;
  const sinMovimiento = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const tarjetasDe = (cont) => [...cont.children].filter((c) => c.classList.contains("product-card"));
  function giftCongelar(card) {
    const cont = card.parentElement;
    if (!cont) return;
    if (!cont.dataset.giftAbiertas) {
      tarjetasDe(cont).forEach((c) => { c.dataset.giftMin = c.style.minHeight; c.style.minHeight = c.offsetHeight + "px"; });
      cont.classList.add("is-gift-open");
      cont.dataset.giftAbiertas = "0";
    }
    cont.dataset.giftAbiertas = String(Number(cont.dataset.giftAbiertas) + 1);
  }
  function giftDescongelar(card) {
    const cont = card.parentElement;
    if (!cont || !cont.dataset.giftAbiertas) return;
    const n = Number(cont.dataset.giftAbiertas) - 1;
    if (n > 0) { cont.dataset.giftAbiertas = String(n); return; }
    delete cont.dataset.giftAbiertas;
    cont.classList.remove("is-gift-open");
    tarjetasDe(cont).forEach((c) => { c.style.minHeight = c.dataset.giftMin || ""; delete c.dataset.giftMin; });
  }
  // Medidas: alto natural de la zona de foto (base), alto del panel y alto final de la zona (T >= base).
  // B = distancia entre el borde inferior del panel y el de la zona de foto: se calcula para que, entre el panel y el
  // bloque del precio, queden siempre GIFT_GAP px (la zona de foto puede solaparse o separarse del pie según la card).
  function giftMedir(card, ov, m) {
    const foot = card.querySelector(".product-card-foot");
    m.style.minHeight = "";
    const base = m.offsetHeight;
    ov.style.height = "auto"; ov.style.bottom = "auto";
    const natural = ov.offsetHeight;
    ov.style.height = ""; ov.style.bottom = "";
    let B = GIFT_GAP, T = Math.max(base, natural + B);
    for (let i = 0; i < 3; i++) {
      m.style.minHeight = T + "px";
      const delta = foot ? foot.getBoundingClientRect().top - m.getBoundingClientRect().bottom : 0;
      const nB = Math.max(0, GIFT_GAP - delta), nT = Math.max(base, natural + nB);
      if (nB === B && nT === T) break;
      B = nB; T = nT;
    }
    m.style.minHeight = "";
    return { base, T, B, P: T - B };
  }
  function giftAnimar(card, abrir, inmediato) {
    const ov = card.querySelector(".gift-overlay"), m = card.querySelector(".product-card-media");
    clearTimeout(ov._t);
    const ms = inmediato || sinMovimiento() ? 0 : (abrir ? GIFT_MS_IN : GIFT_MS_OUT);
    const hOv = ov.offsetHeight, hM = m.offsetHeight; // estado actual (por si se interrumpe otra animación)
    ov.classList.remove("is-anim"); m.classList.remove("is-gift-anim");
    const { base, T, B, P } = giftMedir(card, ov, m);
    ov.style.setProperty("--gift-b", B + "px");
    const fin = () => {
      ov.classList.remove("is-anim"); m.classList.remove("is-gift-anim");
      ov.style.height = "";
      if (abrir) { m.style.minHeight = T + "px"; return; }
      m.style.minHeight = "";
      card.classList.remove("is-gift-card");
      ov.style.removeProperty("--gift-b");
      ov.inert = true; ov.setAttribute("aria-hidden", "true");
      if (ov._cuenta) { ov._cuenta = false; giftDescongelar(card); }
    };
    if (!ms) { ov.classList.toggle("is-open", abrir); if (abrir) m.style.minHeight = T + "px"; fin(); return; }
    ov.style.height = hOv + "px"; m.style.minHeight = hM + "px";
    void ov.offsetHeight; // fija el punto de partida antes de animar
    ov.style.setProperty("--gift-ms", ms + "ms"); m.style.setProperty("--gift-ms", ms + "ms");
    ov.classList.add("is-anim"); m.classList.add("is-gift-anim");
    ov.classList.toggle("is-open", abrir);
    ov.style.height = (abrir ? P : 0) + "px";
    m.style.minHeight = (abrir ? T : base) + "px";
    ov._t = setTimeout(fin, ms + 40);
  }
  function toggleGift(card, abrir, inmediato) {
    const ov = card.querySelector(".gift-overlay"), rb = card.querySelector(".gift-ribbon");
    if (!ov || !rb || abrir === ov.classList.contains("is-open")) return;
    rb.hidden = abrir;
    rb.setAttribute("aria-expanded", String(abrir));
    if (abrir) {
      ov.inert = false; ov.removeAttribute("aria-hidden");
      if (!ov._cuenta) { giftCongelar(card); ov._cuenta = true; }
      card.classList.add("is-gift-card"); // después de congelar: el alto de reposo queda como mínimo y la card solo crece
    }
    giftAnimar(card, abrir, inmediato);
    if (abrir) { const c = ov.querySelector(".gift-overlay-close"); if (c) c.focus({ preventScroll: true }); }
    else rb.focus({ preventScroll: true });
  }
  // Un cambio de ancho vuelve a calcular todo: se cierran los paneles abiertos al instante (el alto de la barra del navegador en celular no cuenta)
  let giftAncho = window.innerWidth;
  window.addEventListener("resize", () => {
    if (window.innerWidth === giftAncho) return;
    giftAncho = window.innerWidth;
    document.querySelectorAll(".gift-overlay.is-open").forEach((ov) => toggleGift(ov.closest(".product-card"), false, true));
  });
  document.addEventListener("click", (e) => {
    const rb = e.target.closest(".gift-ribbon");
    const cierre = e.target.closest(".gift-overlay-close");
    if (!rb && !cierre) return;
    e.stopPropagation();
    toggleGift((rb || cierre).closest(".product-card"), !!rb);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    const ov = document.querySelector(".gift-overlay.is-open");
    if (ov) toggleGift(ov.closest(".product-card"), false);
  });

  // eager: carga inmediata (primera pantalla); alta: además prioridad alta (solo la candidata a LCP)
  function renderProductCard(p, eager = false, alta = false) {
    const colores = p.colores || [];
    const fotosCard = fotosDe(p), imgCard = colorImg(p, 0);
    // Un solo color no se ofrece como elección: los puntos de color aparecen desde 2.
    const swatches = colores.length > 1
      ? `<div class="color-swatches" role="group" aria-label="Colores disponibles">
          ${colores.map((color, i) => `<button type="button" class="color-swatch${i === 0 ? " is-active" : ""}"
            style="--swatch: ${color.hex}" data-img="${escAttr(colorImg(p, i))}" data-alt="${escAttr(p.nombre + " color " + color.nombre.toLowerCase())}"
            aria-label="${escAttr(color.nombre)}" aria-pressed="${i === 0}" title="${escAttr(color.nombre)}"></button>`).join("")}
        </div>`
      : ""; // los puntos van en columna sobre el borde izquierdo de la foto: no ocupan alto propio
    const esAccesorio = p.categoria === "Accesorios";
    const pr = precioDe(p);
    // «Consultar» como precio comparte la fila con el botón: va un poco más chico para que quepan en cards angostas
    const price = (pr.desde ? `<small>${pr.desde}</small>` : "") + `<strong${pr.texto === "Consultar" ? ' class="es-consulta"' : ""}>${pr.texto}</strong>`;
    const usado = esUsado(p);
    const bat = bateriaDe(p);
    const promo = typeof promosDe === "function" ? promosDe(p)[0] : null; // promo vigente que alcanza al producto
    const promoLargo = promo ? (promo.etiqueta || ((promo.regalos || []).length ? "Con regalos" : "")) : "";
    const promoCorto = promo ? (promo.etiquetaCorta || ((promo.regalos || []).length ? "Con regalos" : promoLargo)) : "";
    const promoPill = promoLargo
      ? `<span class="product-card-promo">${ICONO_REGALO}<span class="pp-largo">${promoLargo}</span><span class="pp-corto">${promoCorto}</span></span>` : "";
    const regalosCard = promo ? (promo.regalos || []).filter(Boolean) : [];
    const etiquetaTexto = p.subcategoria || p.categoria;
    const etiqueta = usado ? `<span class="product-card-eyebrow is-used">Usado</span>` : p.nuevo === true ? `<span class="product-card-eyebrow is-new">Nuevo</span>` : `<span class="product-card-eyebrow">${etiquetaTexto}</span>`;
    // «Oportunidad del día»: misma card, con pie azul (etiqueta, precio actual y tachado, botón) en lugar del bloque de precio
    const enOferta = p.oferta === true && Number.isFinite(p.precioAnterior);
    const ICONO_RAYO = `<svg viewBox="0 0 9 11" aria-hidden="true"><path d="M5.5 0L0 6.2h3.4L2.8 11 9 4.3H5.6z"/></svg>`;
    const btnAgregar = `<button type="button" class="btn btn-primary product-card-add" data-add="${escAttr(p.id)}"${usado ? " data-usado" : ""}>${ICONO_MAS}<span class="add-txt">Agregar</span></button>`;
    const pie = enOferta
      ? `<div class="product-card-foot oferta-foot">
          <p class="product-card-price"><small class="oferta-tag">${ICONO_RAYO}Oportunidad del día</small><span class="oferta-row"><strong><span class="sr-only">Precio ahora: </span>${pr.texto}</strong><s><span class="sr-only">Precio anterior: </span>${formatearPrecio(p.precioAnterior, p.moneda)}</s></span></p>
          ${btnAgregar}
        </div>`
      : `<div class="product-card-foot">
          <p class="product-card-price"><span class="sr-only">Precio: </span>${price}</p>
          ${btnAgregar}
        </div>`;
    return `
      <article class="product-card${enOferta ? " product-card--oferta" : ""}" data-id="${escAttr(p.id)}" data-categoria="${p.categoria}" data-condicion="${usado ? "usado" : "nuevo"}"${p.subcategoria ? ` data-subcategoria="${escAttr(p.subcategoria)}"` : ""} data-busqueda="${escAttr(normalizar([p.nombre, p.subcategoria || "", p.variante || "", usado ? "usado" : ""].join(" ")))}">
        <button type="button" class="product-card-open" aria-haspopup="dialog" aria-label="${escAttr("Ver detalle de " + p.nombre + (p.variante ? ", " + p.variante : ""))}"></button>
        ${regalosCard.length ? `<button type="button" class="gift-ribbon" aria-label="Ver el regalo" aria-expanded="false" aria-controls="gift-${escAttr(p.id)}"><span class="gift-ribbon-band">${ICONO_REGALO}Regalo</span></button>` : ""}
        <div class="product-card-head">
          ${etiqueta}
          <h3 class="product-card-name">${p.nombre}</h3>
          ${p.variante ? `<p class="product-card-variant">${p.variante}</p>` : `<p class="product-card-variant product-card-variant--vacio" aria-hidden="true">&nbsp;</p>`}
        </div>
        <div class="product-card-media${imgCard || fotosCard.length ? "" : " product-card-media--vacio"}">
          ${usado ? `<span class="product-card-tag">Usado${bat !== null ? " · " + bat + "%" : ""}</span>` : ""}
          ${fotosCard.length
            ? `<img src="${escAttr(fotosCard[0])}"${srcsetAttr(fotosCard[0])} alt="${escAttr(p.nombre)}" width="728" height="666" loading="${eager ? "eager" : "lazy"}"${alta ? " fetchpriority=\"high\"" : ""} decoding="async">`
            : imgCard
            ? `<img src="${escAttr(imgCard)}"${srcsetAttr(imgCard)} alt="${escAttr(esAccesorio ? p.nombre : p.nombre + " color " + colores[0].nombre.toLowerCase())}" width="728" height="666" loading="${eager ? "eager" : "lazy"}"${alta ? " fetchpriority=\"high\"" : ""} decoding="async">`
            : `<div class="product-card-media-placeholder">${p.categoria === "iPhone" ? ICONO_TELEFONO : ICONO_CAJA}<span>Foto próximamente</span></div>`
          }
          ${regalosCard.length ? giftOverlayHTML("gift-" + escAttr(p.id)) : ""}
          ${swatches}
        </div>
        ${pie}
      </article>`;
  }

  /* Selector de color: delegado a nivel documento para cubrir tanto el
     row del Home como la grilla de catalogo.html. Solo cambia el src de
     la imagen de esa card — no re-renderiza la card. */
  document.addEventListener("click", (e) => {
    const swatch = e.target.closest(".color-swatch");
    if (!swatch) return;
    const card = swatch.closest(".product-card");
    const img = card && card.querySelector(".product-card-media img");
    if (img) {
      const ss = srcsetDe(swatch.dataset.img);
      if (ss) { img.srcset = ss; img.sizes = SRCSET_SIZES; } else img.removeAttribute("srcset");
      img.src = swatch.dataset.img;
      if (swatch.dataset.alt) img.alt = swatch.dataset.alt;
    }
    swatch.parentElement.querySelectorAll(".color-swatch").forEach((s) => {
      s.classList.toggle("is-active", s === swatch);
      s.setAttribute("aria-pressed", String(s === swatch));
    });
  });

  // Si products-data.js no cargó, la fila no queda vacía sin explicación
  const catalogError = `<p class="catalog-error">No pudimos cargar el catálogo en este momento.
    <a data-wa="Hola, quiero consultar por el catálogo" href="https://wa.me/5492614699026" target="_blank" rel="noopener">Consultanos por WhatsApp</a>.</p>`;

  /* Listados de cards: si alguna lleva cartel de promo TODAS reservan la franja (fotos alineadas); si el texto
     largo del cartel no cabe se usa la versión corta; el tamaño del precio depende del ancho de la card. */
  function ajustarListado(cont) {
    if (!cont) return;
    const aplicar = () => {
      const cards = cont.querySelectorAll(".product-card");
      // Listado paginado: las banderas se calculan sobre TODO el listado (data-promos / data-swatches) para que no cambien al sumar cards
      cont.classList.toggle("has-promos", cont.dataset.promos ? cont.dataset.promos === "1" : !!cont.querySelector(".product-card-promo"));
      cont.classList.toggle("has-swatches", cont.dataset.swatches ? cont.dataset.swatches === "1" : !!cont.querySelector(".color-swatches"));
      cont.classList.toggle("is-compact", window.matchMedia(cont.classList.contains("catalog-cards-row") ? "(max-width: 699px)" : "(max-width: 899px)").matches);
      cards.forEach((c) => {
        const w = c.offsetWidth;
        c.classList.toggle("is-w-md", w >= 220 && w < 280);
        const nom = c.querySelector(".product-card-name"); // nombre largo: baja de tamaño de a 1px (mínimo 15px) antes de cortarse
        if (nom && !cont.classList.contains("is-compact") && !c.querySelector(".gift-ribbon")) { // con listón el nombre baja a 2 líneas en vez de achicarse
          nom.style.fontSize = "";
          for (let fs = parseFloat(getComputedStyle(nom).fontSize); nom.scrollWidth > nom.clientWidth && fs > 15; fs--) nom.style.fontSize = (fs - 1) + "px";
        } else if (nom) nom.style.fontSize = "";
        const pill = c.querySelector(".product-card-promo");
        if (pill) { pill.classList.remove("is-corto"); if (pill.scrollWidth > pill.clientWidth) pill.classList.add("is-corto"); }
      });
    };
    aplicar();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(aplicar); // con la tipografía final el nombre puede medir distinto
    // Solo el ANCHO importa acá (tamaño de fuente del nombre, versión corta del cartel): al abrir/cerrar el regalo la card cambia
    // de alto en cada frame y re-medir todas las cards cada vez forzaba cientos de layouts.
    if ("ResizeObserver" in window) {
      const anchos = new WeakMap();
      const ro = new ResizeObserver((es) => {
        let cambio = false;
        es.forEach((e) => { const w = Math.round(e.contentRect.width); if (anchos.get(e.target) !== w) { anchos.set(e.target, w); cambio = true; } });
        if (cambio) aplicar();
      });
      ro.observe(cont); cont.querySelectorAll(".product-card").forEach((c) => ro.observe(c));
      cont.__ajustar = () => { cont.querySelectorAll(".product-card").forEach((c) => ro.observe(c)); aplicar(); }; // tras sumar cards
    } else { window.addEventListener("resize", aplicar); cont.__ajustar = aplicar; }
  }

  const catalogRow = document.querySelector(".catalog-cards-row");
  if (catalogRow) {
    // Última "card": lleva al catálogo completo
    const endCard = `<a class="catalog-end-card" href="catalogo.html">Ver todo el catálogo
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"></path></svg></a>`;
    catalogRow.innerHTML = typeof CATALOGO_DESTACADO !== "undefined"
      ? CATALOGO_DESTACADO.map((p) => renderProductCard(p)).join("") + endCard
      : catalogError;
    ajustarListado(catalogRow);
  }

  /* ============================================================
     CARRUSEL DESTACADO — scroll horizontal nativo (overflow-x + snap).
     El JS solo suma: arrastre con mouse, flechas y barra de progreso.
     La rueda vertical nunca se intercepta.
     ============================================================ */
  function initCatalogCarousel() {
    const row = document.querySelector(".catalog-cards-row");
    if (!row) return;
    const arrows = document.querySelectorAll(".catalog-arrow");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dotnav = document.querySelector(".dotnav");
    const cards = row.querySelectorAll(".product-card");
    const total = cards.length;
    // Un punto por equipo; el activo es el primero visible (o el último al llegar al final)
    const dots = [];
    if (dotnav) {
      cards.forEach((card, i) => {
        const li = document.createElement("li");
        li.className = "dot-item";
        li.style.setProperty("--dot-number", i);
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "dot-link";
        btn.setAttribute("aria-label", "Ver " + (card.querySelector("h3")?.textContent || "equipo " + (i + 1)));
        btn.addEventListener("click", () => {
          const padLeft = parseFloat(getComputedStyle(row).paddingLeft) || 0;
          const left = card.getBoundingClientRect().left - row.getBoundingClientRect().left + row.scrollLeft - padLeft;
          row.scrollTo({ left, behavior: reducedMotion ? "auto" : "smooth" });
        });
        li.appendChild(btn);
        dotnav.appendChild(li);
        dots.push(li);
      });
    }

    function updateUI() {
      const max = row.scrollWidth - row.clientWidth;
      const first = cards[0];
      const step = first ? first.offsetWidth + (parseFloat(getComputedStyle(row).columnGap) || 0) : 1;
      let current = Math.round(row.scrollLeft / step) + 1;
      if (max > 0 && row.scrollLeft >= max - 2) current = total; // al final del carrusel
      current = Math.max(1, Math.min(total, current));
      dots.forEach((li, i) => {
        const on = i === current - 1;
        li.classList.toggle("active", on);
        if (on) li.firstElementChild.setAttribute("aria-current", "true");
        else li.firstElementChild.removeAttribute("aria-current");
      });
      arrows.forEach((btn) => {
        const atEdge = Number(btn.dataset.dir) < 0 ? row.scrollLeft <= 2 : row.scrollLeft >= max - 2;
        btn.setAttribute("aria-disabled", String(atEdge));
      });
    }
    // el scroll se procesa una vez por frame
    let ticking = false;
    row.addEventListener("scroll", () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => { ticking = false; updateUI(); });
    }, { passive: true });
    window.addEventListener("resize", updateUI);
    updateUI();

    // Difuminado de bordes (≥700px): --fade-l / --fade-r = F solo si hay contenido a ese lado
    const wide = window.matchMedia("(min-width: 700px)");
    let fadeTicking = false;
    function updateFade() {
      fadeTicking = false;
      const f = wide.matches ? (parseFloat(getComputedStyle(row).paddingLeft) || 0) : 0;
      const hayIzq = f > 0 && row.scrollLeft > 1;
      const hayDer = f > 0 && row.scrollLeft + row.clientWidth < row.scrollWidth - 1;
      row.style.setProperty("--fade-l", hayIzq ? f + "px" : "0px");
      row.style.setProperty("--fade-r", hayDer ? f + "px" : "0px");
    }
    function queueFade() {
      if (fadeTicking) return;
      fadeTicking = true;
      requestAnimationFrame(updateFade);
    }
    row.addEventListener("scroll", queueFade, { passive: true });
    if ("ResizeObserver" in window) new ResizeObserver(queueFade).observe(row);
    else window.addEventListener("resize", queueFade);
    updateFade();

    // Entrada escalonada, una sola vez (sin movimiento si el usuario lo pidió)
    if (!reducedMotion && "IntersectionObserver" in window) {
      [...row.children].forEach((el, i) => el.style.setProperty("--i", Math.min(i, 6)));
      row.classList.add("is-reveal-pending");
      const io = new IntersectionObserver((entries) => {
        if (!entries.some((en) => en.isIntersecting)) return;
        io.disconnect();
        row.classList.remove("is-reveal-pending");
        row.classList.add("is-revealed");
        setTimeout(() => row.classList.remove("is-revealed"), 1200);
      }, { threshold: 0.15 });
      io.observe(row);
    }

    // Flechas: una card por click
    arrows.forEach((btn) => {
      btn.addEventListener("click", () => {
        if (btn.getAttribute("aria-disabled") === "true") return;
        const card = row.querySelector(".product-card");
        if (!card) return;
        const gap = parseFloat(getComputedStyle(row).columnGap) || 0;
        row.scrollBy({ left: Number(btn.dataset.dir) * (card.offsetWidth + gap), behavior: reducedMotion ? "auto" : "smooth" });
      });
    });

    // Arrastre con mouse (el touch ya es nativo)
    let startX = 0, startLeft = 0, dragging = false, moved = false;
    row.addEventListener("pointerdown", (e) => {
      if (e.pointerType !== "mouse" || e.button !== 0 || e.target.closest(".gift-overlay")) return;
      dragging = true;
      moved = false;
      startX = e.clientX;
      startLeft = row.scrollLeft;
    });
    row.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      if (!moved && Math.abs(dx) > 5) {
        moved = true;
        row.classList.add("is-dragging"); // desactiva el snap mientras se arrastra
        row.setPointerCapture(e.pointerId);
      }
      if (moved) row.scrollLeft = startLeft - dx;
    });
    const endDrag = () => {
      dragging = false;
      row.classList.remove("is-dragging");
    };
    row.addEventListener("pointerup", endDrag);
    row.addEventListener("pointercancel", endDrag);
    // Si hubo arrastre, el click que sigue al pointerup no debe llegar a card/swatch/botón
    row.addEventListener("click", (e) => {
      if (moved) {
        e.preventDefault();
        e.stopPropagation();
        moved = false;
      }
    }, true);
    row.addEventListener("dragstart", (e) => e.preventDefault());
  }
  try { initCatalogCarousel(); } catch (e) { /* mejora secundaria: un error aquí no corta el resto */ }
  // Compartido con js/pedido.js (Mi pedido)
  window.TL = { expandirAccesorios, variante: varianteDe, bateriaDe };

  const catalogGrid = document.querySelector(".catalog-grid-full");
  if (catalogGrid && typeof CATALOGO_DESTACADO === "undefined") {
    catalogGrid.innerHTML = catalogError;
  }
  if (catalogGrid && typeof CATALOGO_DESTACADO !== "undefined") {
    // El carrusel del Home usa SOLO CATALOGO_DESTACADO; la grilla del catálogo suma los accesorios.
    const productos = [...CATALOGO_DESTACADO, ...expandirAccesorios()];
    // Paginado: se muestran 12 y «Ver más» suma de a 12. Filtros y buscador trabajan sobre la lista completa (datos) y luego se pagina.
    const PAGINA = 12;
    const hayPromo = (p) => { const pr = typeof promosDe === "function" ? promosDe(p)[0] : null; return !!(pr && (pr.etiqueta || (pr.regalos || []).length)); };
    catalogGrid.dataset.promos = productos.some(hayPromo) ? "1" : "0";
    catalogGrid.dataset.swatches = productos.some((p) => (p.colores || []).length > 1) ? "1" : "0";
    ajustarListado(catalogGrid);

    /* Filtros 100% client-side (solo esconden/muestran las .product-card ya renderizadas):
       - pestañas de categoría generadas desde los datos (nunca hardcodeadas);
       - al elegir "Accesorios", una segunda fila de chips de subcategoría (también desde los datos);
       - buscador insensible a mayúsculas y tildes, en nombre + subcategoría + variante, combinado
         con la pestaña/chip activos.
       URL: ?cat=Accesorios preselecciona la pestaña y ?q=texto, la búsqueda. */
    const filterTabs = document.querySelector(".catalog-filter-tabs");
    const subRow = document.querySelector(".catalog-subfilters");
    const subTabs = document.querySelector(".catalog-subtabs");
    const filterSearch = document.querySelector(".catalog-filter-search");
    const countEl = document.querySelector(".catalog-count");
    const emptyEl = document.querySelector(".catalog-empty");
    const emptyBtn = emptyEl ? emptyEl.querySelector("a") : null;
    const categorias = [...new Set(productos.map((p) => p.categoria))];
    const subcategorias = [...new Set(productos.filter((p) => p.subcategoria).map((p) => p.subcategoria))];
    const params = new URLSearchParams(window.location.search);
    let activeCat = categorias.find((c) => normalizar(c) === normalizar(params.get("cat") || "")) || "all";
    // ?sub=Cables preselecciona el chip de subcategoría (y, si falta ?cat, la pestaña Accesorios)
    let activeSub = subcategorias.find((s) => normalizar(s) === normalizar(params.get("sub") || "")) || "all";
    if (activeSub !== "all") activeCat = "Accesorios";
    if (filterSearch && params.get("q")) filterSearch.value = params.get("q");

    const btnFiltro = (clase, valor, label, activo) =>
      `<button type="button" class="catalog-filter-tab ${clase}${activo ? " is-active" : ""}" data-value="${escAttr(valor)}" aria-pressed="${activo}">${label}</button>`;
    if (filterTabs) {
      filterTabs.innerHTML = [btnFiltro("", "all", "Todos", activeCat === "all"), ...categorias.map((c) => btnFiltro("", c, c, activeCat === c))].join("");
    }
    if (subTabs) {
      subTabs.innerHTML = [btnFiltro("catalog-subtab", "all", "Todas", activeSub === "all"), ...subcategorias.map((s) => btnFiltro("catalog-subtab", s, s, activeSub === s))].join("");
    }

    const activar = (grupo, btn) => {
      grupo.querySelectorAll(".catalog-filter-tab").forEach((t) => {
        t.classList.toggle("is-active", t === btn);
        t.setAttribute("aria-pressed", String(t === btn));
      });
    };
    const searchClear = document.querySelector(".catalog-search-clear");
    const emptyClear = emptyEl ? emptyEl.querySelector(".catalog-empty-clear") : null;
    // Filtro de estado (iPhone): segunda fila Todos / Nuevos / Usados, solo con la categoría iPhone activa. ?cond=usado|nuevo
    const condTabs = document.querySelector(".catalog-condtabs");
    let activeCond = /^usados?$/i.test(params.get("cond") || "") ? "usado" : /^nuevos?$/i.test(params.get("cond") || "") ? "nuevo" : "all";
    if (activeCond !== "all" && activeCat === "all") activeCat = categorias.find((c) => normalizar(c) === "iphone") || "all";
    if (activeCat !== "iPhone") activeCond = "all";
    if (condTabs) {
      condTabs.innerHTML = btnFiltro("", "all", "Todos", activeCond === "all") + btnFiltro("", "nuevo", "Nuevos", activeCond === "nuevo") + btnFiltro("", "usado", "Usados", activeCond === "usado");
      condTabs.addEventListener("click", (e) => {
        const btn = e.target.closest(".catalog-filter-tab");
        if (!btn) return;
        activeCond = btn.dataset.value;
        activar(condTabs, btn);
        applyCatalogFilter();
      });
    }

    let filtrados = productos, mostrados = 0;
    const busqueda = new Map(productos.map((p) => [p, normalizar([p.nombre, p.subcategoria || "", p.variante || "", esUsado(p) ? "usado" : ""].join(" "))]));
    const moreWrap = document.querySelector(".catalog-more-wrap");
    const moreBtn = document.querySelector(".catalog-more");
    const moreStatus = document.querySelector(".catalog-more-status");
    const pintarTarjetas = (desde, hasta) => {
      catalogGrid.insertAdjacentHTML("beforeend", filtrados.slice(desde, hasta).map((p, i) => renderProductCard(p, desde + i < 4, desde + i === 0)).join(""));
      if (catalogGrid.__ajustar) catalogGrid.__ajustar();
    };
    const pintarMas = () => {
      const faltan = filtrados.length - mostrados;
      if (moreWrap) moreWrap.hidden = faltan <= 0;
      if (moreBtn) moreBtn.textContent = "Ver más (" + faltan + " restantes)";
      if (moreStatus) moreStatus.textContent = filtrados.length ? "Mostrando " + mostrados + " de " + filtrados.length + (filtrados.length === 1 ? " producto" : " productos") : "";
    };
    if (moreBtn) moreBtn.addEventListener("click", () => {
      const antes = mostrados;
      mostrados = Math.min(mostrados + PAGINA, filtrados.length);
      pintarTarjetas(antes, mostrados);
      pintarMas();
      if (moreWrap.hidden) { const nueva = catalogGrid.children[antes]; const op = nueva && nueva.querySelector(".product-card-open"); if (op) op.focus({ preventScroll: true }); } // el botón desaparece: el foco pasa a la primera card nueva
    });
    const applyCatalogFilter = () => {
      const esAccesorios = activeCat === "Accesorios", esIphone = activeCat === "iPhone";
      if (subTabs) subTabs.hidden = !esAccesorios;
      if (condTabs) condTabs.hidden = !esIphone;
      if (subRow) subRow.hidden = !(esAccesorios || esIphone);
      const terminos = normalizar(filterSearch ? filterSearch.value.trim() : "").split(/\s+/).filter(Boolean);
      if (searchClear) searchClear.hidden = !(filterSearch && filterSearch.value);
      filtrados = productos.filter((p) => {
        const okCat = activeCat === "all" || p.categoria === activeCat;
        const okSub = !esAccesorios || activeSub === "all" || p.subcategoria === activeSub;
        const okQuery = terminos.every((t) => busqueda.get(p).includes(t));
        const okCond = !esIphone || activeCond === "all" || (esUsado(p) ? "usado" : "nuevo") === activeCond;
        return okCat && okSub && okQuery && okCond;
      });
      const visible = filtrados.length;
      mostrados = Math.min(PAGINA, visible);
      // un re-render descarta cualquier regalo abierto: se limpia el estado del contenedor
      catalogGrid.classList.remove("is-gift-open"); delete catalogGrid.dataset.giftAbiertas;
      catalogGrid.replaceChildren();
      pintarTarjetas(0, mostrados);
      pintarMas();
      if (countEl) countEl.textContent = visible + (visible === 1 ? " producto" : " productos");
      if (emptyEl) emptyEl.hidden = visible > 0;
      if (emptyBtn && visible === 0 && typeof SITE_CONFIG !== "undefined") {
        const q = filterSearch ? filterSearch.value.trim() : "";
        emptyBtn.href = "https://wa.me/" + SITE_CONFIG.whatsappNumber + "?text=" +
          encodeURIComponent(q ? "Hola, estoy buscando \"" + q + "\" y no lo encuentro en el catálogo" : "Hola, no encuentro en el catálogo el producto que busco");
      }
    };

    if (filterTabs) {
      filterTabs.addEventListener("click", (e) => {
        const btn = e.target.closest(".catalog-filter-tab");
        if (!btn) return;
        activeCat = btn.dataset.value;
        activar(filterTabs, btn);
        if (activeCat !== "iPhone") { activeCond = "all"; if (condTabs) activar(condTabs, condTabs.querySelector('[data-value="all"]')); }
        if (activeCat !== "Accesorios") { // al salir de Accesorios, la fila de chips se oculta y se resetea
          activeSub = "all";
          if (subTabs) activar(subTabs, subTabs.querySelector('[data-value="all"]'));
        }
        applyCatalogFilter();
      });
    }
    if (subTabs) {
      subTabs.addEventListener("click", (e) => {
        const btn = e.target.closest(".catalog-filter-tab");
        if (!btn) return;
        activeSub = btn.dataset.value;
        activar(subTabs, btn);
        applyCatalogFilter();
      });
    }
    // Búsqueda: debounce de 150 ms; solo muestra/oculta cards ya renderizadas (sin re-render: no mueve el foco ni el scroll)
    let debounce = 0;
    if (filterSearch) filterSearch.addEventListener("input", () => {
      if (searchClear) searchClear.hidden = !filterSearch.value;
      clearTimeout(debounce);
      debounce = setTimeout(applyCatalogFilter, 150);
    });
    if (searchClear) searchClear.addEventListener("click", () => { filterSearch.value = ""; applyCatalogFilter(); filterSearch.focus({ preventScroll: true }); });
    const limpiarTodo = () => {
      if (filterSearch) filterSearch.value = "";
      activeCat = "all"; activeSub = "all"; activeCond = "all";
      if (filterTabs) activar(filterTabs, filterTabs.querySelector('[data-value="all"]'));
      if (subTabs) activar(subTabs, subTabs.querySelector('[data-value="all"]'));
      if (condTabs) activar(condTabs, condTabs.querySelector('[data-value="all"]'));
      applyCatalogFilter();
    };
    if (emptyClear) emptyClear.addEventListener("click", limpiarTodo);
    applyCatalogFilter();
  }

  /* ============================================================
     ACCESOS RÁPIDOS (Home) — una categoría con productos lleva al catálogo
     filtrado; una sin productos cargados no se oculta: pasa a consultar
     disponibilidad por WhatsApp.
     ============================================================ */
  document.querySelectorAll(".category-card[data-cat]").forEach((card) => {
    const cat = card.dataset.cat;
    const hasProducts = typeof CATALOGO_DESTACADO !== "undefined" && CATALOGO_DESTACADO.some((p) => p.categoria === cat);
    if (hasProducts) return;
    card.setAttribute("data-wa", "Hola, quiero consultar disponibilidad de " + cat);
    card.setAttribute("target", "_blank");
    card.setAttribute("rel", "noopener");
    card.setAttribute("href", "https://wa.me/5492614699026");
    const cta = card.querySelector(".category-card-cta");
    if (cta) cta.textContent = "Consultá disponibilidad";
  });

  /* ============================================================
     MAPA — se carga solo en el Home, cuando se acerca al viewport
     ============================================================ */

  /* ============================================================
     STAT NUMBERS — conteo 0 → valor final al entrar en viewport.
     El HTML ya trae el valor final (sin JS o con reduced-motion se ve
     correcto); el JS lo baja a 0 solo si va a animar.
     ============================================================ */
  function initStatCounters() {
    const numbers = document.querySelectorAll(".stat-number[data-count]");
    if (!numbers.length) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return;

    const DURATION = 1600;
    const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
    const format = (el, n) => (el.dataset.prefix || "") + n + (el.dataset.suffix || "");

    const animate = (el) => {
      const target = parseInt(el.dataset.count, 10);
      const start = performance.now();
      const step = (now) => {
        const t = Math.min((now - start) / DURATION, 1);
        el.textContent = format(el, Math.round(target * easeOutCubic(t)));
        if (t < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        observer.unobserve(entry.target);
        const num = entry.target.matches(".stat-number") ? entry.target : entry.target.querySelector(".stat-number[data-count]");
        if (num) animate(num);
      });
    }, { threshold: 0.4 });

    numbers.forEach((el) => {
      el.textContent = format(el, 0);
      observer.observe(el.closest(".stat-block") || el);
    });
  }

  try { initStatCounters(); } catch (e) { /* mejora secundaria: un error aquí no corta el resto */ }
  try { applyWhatsAppLinks(); } catch (e) { /* mejora secundaria: un error aquí no corta el resto */ }

  /* ============================================================
     REVELADO DE TÍTULOS (y [data-reveal]) — h2 de las secciones y elementos
     marcados con data-reveal: opacidad + translateY, una sola vez al entrar en
     viewport. Los [data-reveal] que entran juntos se escalonan en orden del
     documento (--reveal-delay, de a REVEAL_STAGGER ms); los h2 no se demoran.
     Sin movimiento (reduced-motion) o sin IntersectionObserver no se oculta
     nada. El CSS vive en style.css (.reveal; las cards de #plan-canje suman el suyo).
     ============================================================ */
  function initTitleReveal() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return;
    const titles = document.querySelectorAll("main h2:not(.hero h2):not(#calculadora h2), main [data-reveal]");
    if (!titles.length) return;
    const REVEAL_STAGGER = 150;
    const observer = new IntersectionObserver((entries) => {
      let enTanda = 0; // [data-reveal] que entran en este mismo aviso del observer
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        if (entry.target.hasAttribute("data-reveal")) {
          entry.target.style.setProperty("--reveal-delay", enTanda++ * REVEAL_STAGGER + "ms");
        }
        entry.target.classList.add("is-in");
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.2 });
    titles.forEach((t) => { t.classList.add("reveal"); observer.observe(t); });
  }
  try { initTitleReveal(); } catch (e) { /* mejora secundaria: un error aquí no corta el resto */ }

  /* ============================================================
     CALCULADORA DE PLAN CANJE — la interfaz arma el DOM acá. El CÁLCULO lo hace el servidor: el formulario manda
     los datos por POST a SITE_CONFIG.canjeWebhookUrl (webhook de n8n), que responde el rango y guarda el lead.
     En el navegador no hay ningún valor de toma: solo las opciones del formulario (js/canje-opciones.js) y
     validaciones puras (js/calculadora-logic.js). Sin eval, sin localStorage, sin guardar datos del usuario.
     Mientras CANJE_CONFIG.datosReales sea false NO se renderiza (el contenedor queda
     vacío y hidden), salvo con ?preview=1, que agrega una franja de aviso.
     ============================================================ */
  function initCalculadora() {
    if (typeof CANJE_CONFIG === "undefined") return;
    const habilitada = CANJE_CONFIG.datosReales === true;
    // Home: el link "Calculá tu valor →" solo se muestra con datos reales
    document.querySelectorAll("[data-calc-link]").forEach((a) => { a.hidden = !habilitada; });

    const root = document.getElementById("calculadora");
    if (!root || typeof CalculadoraCanje === "undefined" || typeof CANJE_OPCIONES === "undefined") return;
    const preview = new URLSearchParams(window.location.search).get("preview") === "1";
    if (!habilitada && !preview) return;

    const Calc = CalculadoraCanje;
    const TIMEOUT_MS = 10000;
    const waLink = (texto) =>
      "https://wa.me/" + (typeof SITE_CONFIG !== "undefined" ? SITE_CONFIG.whatsappNumber : "") + "?text=" + encodeURIComponent(texto);

    const el = (tag, props = {}, ...hijos) => {
      const n = document.createElement(tag);
      Object.entries(props).forEach(([k, v]) => {
        if (k === "class") n.className = v;
        else if (k === "text") n.textContent = v;
        else if (v === true) n.setAttribute(k, "");
        else if (v !== false && v != null) n.setAttribute(k, v);
      });
      hijos.flat().forEach((h) => { if (h) n.append(h); });
      return n;
    };
    // Cada control recuerda su ayuda (aria-describedby base): los errores se agregan y se quitan sin perderla
    const field = (id, label, control, ayuda) => {
      if (ayuda) { control.setAttribute("aria-describedby", id + "-ayuda"); control.dataset.ayuda = id + "-ayuda"; }
      return el("div", { class: "calc-field" },
        el("label", { for: id, text: label }), control,
        ayuda ? el("p", { class: "calc-help", id: id + "-ayuda", text: ayuda }) : null);
    };

    // Equipos de interés: los iPhone del catálogo (nombres sin repetir; sin precios)
    const deseados = [];
    if (typeof CATALOGO_DESTACADO !== "undefined") {
      CATALOGO_DESTACADO.forEach((p) => { if (p.categoria === "iPhone" && p.nombre && !deseados.includes(p.nombre)) deseados.push(p.nombre); });
    }
    const NO_SE = "Todavía no lo sé";

    // --- Controles
    const selModelo = el("select", { id: "calc-modelo", name: "modelo" },
      el("option", { value: "", text: "Elegí un modelo" }),
      Calc.agruparModelosPorGeneracion(CANJE_OPCIONES).map((g) =>
        el("optgroup", { label: g.etiqueta }, g.modelos.map((m) => el("option", { value: m.id, text: m.nombre })))),
      el("option", { value: Calc.NO_LISTADO, text: "Mi modelo no está en la lista" }));
    const selCap = el("select", { id: "calc-capacidad", name: "capacidad", disabled: true },
      el("option", { value: "", text: "Elegí una capacidad" }));
    const inBateria = el("input", { id: "calc-bateria", name: "bateria", type: "number", inputmode: "numeric", min: "1", max: "100", step: "1" });
    const chkDetalles = el("input", { id: "calc-detalles", name: "detalles", type: "checkbox" });
    const txtDetalles = el("textarea", { id: "calc-detalles-texto", name: "detallesTexto", rows: "3", maxlength: "300" });
    const inOtro = el("input", { id: "calc-modelo-texto", name: "modeloTexto", type: "text", maxlength: "60", autocomplete: "off" });
    const inNombre = el("input", { id: "calc-nombre", name: "nombre", type: "text", maxlength: "60", autocomplete: "name" });
    const inWhatsapp = el("input", { id: "calc-whatsapp", name: "whatsapp", type: "tel", inputmode: "numeric", maxlength: "20", autocomplete: "tel-national" });
    const selDeseado = el("select", { id: "calc-deseado", name: "deseado" },
      deseados.map((n) => el("option", { value: n, text: n })),
      el("option", { value: NO_SE, text: NO_SE }));
    selDeseado.value = NO_SE;
    const chkConsent = el("input", { id: "calc-consentimiento", name: "consentimiento", type: "checkbox" });
    // Campo trampa para bots: oculto con CSS, fuera del orden de tabulación y del lector de pantalla. NO se completa.
    const inTrampa = el("input", { id: "calc-web", name: "web", type: "text", tabindex: "-1", autocomplete: "off" });
    const trampa = el("div", { class: "calc-trampa", "aria-hidden": "true" }, inTrampa);
    const btnEnviar = el("button", { class: "btn btn-primary calc-submit", type: "submit", text: "Ver mi valor estimado" });

    const fCap = field("calc-capacidad", "Capacidad", selCap);
    const fBat = field("calc-bateria", "Salud de batería (%)", inBateria, "Lo ves en Ajustes › Batería › Estado de la batería");
    const filaDetalles = el("div", { class: "calc-check" }, chkDetalles,
      el("label", { for: "calc-detalles", text: "Mi iPhone tiene detalles (pantalla rota, golpes, no enciende, etc.)" }));
    const boxDetalles = el("div", { class: "calc-field", hidden: true },
      el("label", { for: "calc-detalles-texto", text: "Contanos los detalles (opcional)" }), txtDetalles);
    const fOtro = field("calc-modelo-texto", "¿Qué modelo es?", inOtro, "Escribí el modelo y la memoria si la sabés. Lo tasamos en el local.");
    fOtro.hidden = true;
    const fConsent = el("div", { class: "calc-field calc-field--check" },
      el("div", { class: "calc-check" }, chkConsent,
        el("label", { for: "calc-consentimiento" },
          "Acepto que Tecnolab use estos datos para contactarme por mi cotización. ",
          el("a", { href: "terminos.html#privacidad", target: "_blank", rel: "noopener", text: "Ver Términos y Privacidad" }))));
    const resultado = el("div", { class: "calc-result", id: "calc-resultado", tabindex: "-1", "aria-live": "polite" });

    const form = el("form", { class: "calc-card", novalidate: true, "aria-labelledby": "calc-titulo" },
      el("h2", { class: "title-sentence", id: "calc-titulo", text: "Calculá cuánto te tomamos tu iPhone" }),
      field("calc-modelo", "Modelo", selModelo),
      fCap, fBat, filaDetalles, boxDetalles, fOtro,
      field("calc-nombre", "Tu nombre", inNombre),
      field("calc-whatsapp", "Tu WhatsApp", inWhatsapp, "Con código de área, sin 0 ni 15. Ej: 261 4699026"),
      field("calc-deseado", "¿Por cuál equipo te gustaría cambiarlo?", selDeseado),
      fConsent, trampa, btnEnviar);

    root.append(el("div", { class: "container" },
      el("div", { class: "calc" },
        !habilitada ? el("p", { class: "calc-preview", text: "VISTA PREVIA — datos de ejemplo" }) : null,
        form, resultado)));
    root.hidden = false;

    // --- Comportamiento
    const limpiar = () => {
      resultado.replaceChildren();
      form.querySelectorAll(".calc-error").forEach((e) => e.remove());
      form.querySelectorAll("[aria-invalid]").forEach((c) => {
        c.removeAttribute("aria-invalid");
        if (c.dataset.ayuda) c.setAttribute("aria-describedby", c.dataset.ayuda); else c.removeAttribute("aria-describedby");
      });
    };

    // "Mi modelo no está en la lista": sin capacidad ni batería ni detalles; solo el modelo escrito (y los datos de contacto)
    const modoOtro = (on) => {
      fCap.hidden = on;
      fBat.hidden = on;
      filaDetalles.hidden = on;
      boxDetalles.hidden = on || !chkDetalles.checked;
      fOtro.hidden = !on;
    };

    selModelo.addEventListener("change", () => {
      limpiar();
      if (selModelo.value === Calc.NO_LISTADO) { modoOtro(true); return; }
      modoOtro(false);
      const m = Calc.buscarModelo(CANJE_OPCIONES, selModelo.value);
      selCap.replaceChildren(el("option", { value: "", text: "Elegí una capacidad" }),
        ...(m ? m.capacidades : []).map((gb) => el("option", { value: String(gb), text: gb + " GB" })));
      selCap.disabled = !m;
      if (m && m.capacidades.length === 1) selCap.value = String(m.capacidades[0]); // una sola memoria: ya elegida
    });
    [selCap, inBateria, txtDetalles, inOtro, inNombre, inWhatsapp, selDeseado, chkConsent].forEach((c) => c.addEventListener("input", limpiar));
    chkDetalles.addEventListener("change", () => { boxDetalles.hidden = !chkDetalles.checked; limpiar(); });

    const controles = { modelo: selModelo, capacidad: selCap, bateria: inBateria, modeloTexto: inOtro, nombre: inNombre, whatsapp: inWhatsapp, consentimiento: chkConsent };
    const mostrarErrores = (errores) => {
      let primero = null;
      Object.keys(errores).forEach((k) => {
        const control = controles[k];
        if (!control) return;
        const id = "calc-error-" + k;
        control.setAttribute("aria-invalid", "true");
        control.setAttribute("aria-describedby", (control.dataset.ayuda ? control.dataset.ayuda + " " : "") + id);
        control.closest(".calc-field").append(el("p", { class: "calc-error", id, role: "alert", text: errores[k] }));
        primero = primero || control;
      });
      if (primero) primero.focus();
    };

    const botonWa = (texto, etiqueta, clase) =>
      el("a", { class: "btn " + clase, href: waLink(texto), target: "_blank", rel: "noopener", text: etiqueta });
    const mostrarResultado = (partes) => {
      resultado.replaceChildren(el("div", { class: "calc-card calc-card--result" }, partes));
      resultado.focus();
    };

    // La respuesta del servidor se acepta solo si tiene la forma esperada; si no, se trata como error (nunca se muestra un precio dudoso)
    const num = (n) => typeof n === "number" && isFinite(n) && n > 0;
    const respuestaValida = (r) => {
      if (!r || typeof r !== "object" || typeof r.ok !== "boolean") return false;
      if (!r.ok) return ["whatsapp", "nombre", "consentimiento"].includes(r.error);
      if (r.tipo === "rango") return num(r.min) && num(r.max) && r.min <= r.max;
      if (r.tipo === "hasta") return num(r.max);
      return r.tipo === "consulta";
    };

    async function consultarServidor(payload) {
      const url = typeof SITE_CONFIG !== "undefined" ? SITE_CONFIG.canjeWebhookUrl : "";
      if (!url) throw new Error("sin endpoint");
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: ctrl.signal
        });
        if (!res.ok) throw new Error("HTTP " + res.status);
        const data = await res.json();
        if (!respuestaValida(data)) throw new Error("respuesta inválida");
        return data;
      } finally { clearTimeout(timer); }
    }

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (btnEnviar.disabled) return;
      limpiar();
      const entrada = {
        modeloId: selModelo.value,
        gb: selCap.value,
        bateria: inBateria.value,
        detalles: chkDetalles.checked,
        detallesTexto: txtDetalles.value,
        modeloTexto: inOtro.value,
        nombre: inNombre.value,
        whatsapp: inWhatsapp.value,
        consentimiento: chkConsent.checked
      };
      const errores = Calc.validarFormulario(CANJE_OPCIONES, entrada);
      if (Object.keys(errores).length) { mostrarErrores(errores); return; }

      const modelo = Calc.buscarModelo(CANJE_OPCIONES, entrada.modeloId);
      const bateria = Calc.parsearBateria(entrada.bateria);
      const payload = {
        nombre: entrada.nombre.trim(),
        whatsapp: entrada.whatsapp.trim(),
        modelo: modelo ? modelo.nombre : "",
        capacidad: modelo ? Number(entrada.gb) : null,
        bateria: modelo ? bateria : null,
        detalles: modelo ? entrada.detalles : false,
        detallesTexto: modelo && entrada.detalles ? entrada.detallesTexto.trim() : "",
        modeloTexto: modelo ? "" : entrada.modeloTexto.trim(),
        deseado: selDeseado.value,
        consentimiento: true,
        web: inTrampa.value,
        fuente: "calculadora"
      };
      const mensajeWa = Calc.mensajeWhatsApp(modelo, entrada, bateria, selDeseado.value);

      btnEnviar.disabled = true;
      btnEnviar.setAttribute("aria-busy", "true");
      btnEnviar.textContent = "Calculando…";
      try {
        const r = await consultarServidor(payload);
        if (!r.ok) { mostrarErrores({ [r.error]: Calc.MENSAJES_SERVIDOR[r.error] }); return; }
        const partes = [];
        if (r.tipo === "rango") {
          partes.push(el("p", { class: "calc-consulta", text: "Tu iPhone vale entre " + Calc.formatearMonto(r.moneda, r.min) + " y " + Calc.formatearMonto(r.moneda, r.max) }));
        } else if (r.tipo === "hasta") {
          partes.push(el("p", { class: "calc-consulta", text: "Tu iPhone vale hasta " + Calc.formatearMonto(r.moneda, r.max) }),
            el("p", { class: "calc-tramo", text: "El valor final se confirma en el local, según el estado real del equipo." }));
        } else {
          partes.push(el("p", { class: "calc-consulta", text: "Tenemos que evaluar tu equipo. Te escribimos por WhatsApp con la cotización." }));
        }
        partes.push(el("p", { class: "calc-help", text: "Te escribimos por WhatsApp para confirmarte el precio final." }),
          el("p", { class: "calc-aviso", text: CANJE_CONFIG.avisoLegal }),
          el("div", { class: "calc-acciones" }, botonWa(mensajeWa, "Hablar ahora por WhatsApp", "btn-outline")));
        mostrarResultado(partes);
      } catch (err) {
        // Red caída, timeout, HTTP de error o respuesta rara: nunca se muestra un precio
        mostrarResultado([
          el("p", { class: "calc-consulta", text: "No pudimos calcularlo ahora. Escribinos por WhatsApp y te lo pasamos al instante." }),
          el("div", { class: "calc-acciones" }, botonWa(mensajeWa, "Escribinos por WhatsApp", "btn-primary"))]);
      } finally {
        btnEnviar.disabled = false;
        btnEnviar.removeAttribute("aria-busy");
        btnEnviar.textContent = "Ver mi valor estimado";
      }
    });
  }
  try { initCalculadora(); } catch (e) { /* mejora secundaria: un error aquí no corta el resto */ }
  /* ============================================================
     OPINIONES — dos piezas con los datos de js/reviews-data.js:
     a) #opiniones-franja (justo después del hero): promedios de Google Maps y reseñas en loop
        (pista duplicada, translateX 0 → -50%, solo CSS; pausa con hover/foco). Sin estrellas por reseña.
     b) #opiniones (después del catálogo destacado): ventanas cuadradas con fotos de clientes que siguen
        al mouse. Un solo pointermove (throttle con rAF), pool fijo de nodos, activo solo mientras la
        sección está en pantalla (IntersectionObserver), sin scroll listeners. La grilla se ajusta al
        ancho (celdas cuadradas e iguales, última fila completa) y las celdas que tocan texto
        ([data-foto-evitar]) se atenúan. Sin mouse fino o con reduced-motion: tira estática.
     ============================================================ */
  function initOpiniones() {
    if (typeof SUCURSALES_RESENAS === "undefined") return;
    const mk = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
    const coma = (n) => String(n).replace(".", ",");
    const corto = { dorrego: "Sucursal Dorrego", lomas: "Sucursal Lomas" };

    // Componente único de estrellas: un <symbol> SVG que se inyecta una sola vez y 5 <use> por grupo (role="img").
    const NS = "http://www.w3.org/2000/svg";
    function estrellas() {
      if (!document.getElementById("icono-estrella")) {
        const sprite = document.createElementNS(NS, "svg");
        sprite.setAttribute("width", "0"); sprite.setAttribute("height", "0");
        sprite.setAttribute("aria-hidden", "true"); sprite.style.position = "absolute";
        sprite.innerHTML = '<symbol id="icono-estrella" viewBox="0 0 24 24"><path d="M12 2.5l2.94 6.1 6.56.9-4.8 4.6 1.2 6.6L12 17.5l-5.9 3.2 1.2-6.6-4.8-4.6 6.56-.9z"></path></symbol>';
        document.body.prepend(sprite);
      }
      const g = mk("span", "estrellas");
      g.setAttribute("role", "img");
      g.setAttribute("aria-label", "5 de 5 estrellas");
      for (let i = 0; i < 5; i++) {
        const svg = document.createElementNS(NS, "svg");
        svg.setAttribute("aria-hidden", "true"); svg.setAttribute("focusable", "false");
        const use = document.createElementNS(NS, "use");
        use.setAttribute("href", "#icono-estrella");
        svg.append(use); g.append(svg);
      }
      return g;
    }

    // ---------- a) franja ----------
    const fr = document.getElementById("opiniones-franja");
    if (fr) {
      const score = fr.querySelector(".opiniones-score");
      SUCURSALES_RESENAS.forEach((suc) => {
        const a = mk("a");
        a.href = suc.mapsUrl; a.target = "_blank"; a.rel = "noopener";
        a.setAttribute("aria-label", (corto[suc.id] || suc.nombre) + ": 5 estrellas en Google Maps");
        a.append(estrellas(), mk("span", "opiniones-suc", corto[suc.id] || suc.nombre));
        score.append(a);
      });
      fr.querySelector(".opiniones-legend").textContent = "Datos de Google Maps, " + (typeof RESENAS_ACTUALIZADO !== "undefined" ? RESENAS_ACTUALIZADO : "");

      const crearCard = (r, s) => {
        const card = mk("article", "opinion-card");
        const datos = mk("div", "opinion-card-datos");
        datos.append(mk("strong", "", r.autor), mk("span", "", s.nombre));
        if (r.localGuide) datos.append(mk("span", "opinion-card-badge", "Local Guide"));
        const autor = mk("div", "opinion-card-autor");
        autor.append(mk("span", "opinion-card-inicial", r.autor.charAt(0)), datos);
        card.append(estrellas(), mk("blockquote", "", r.texto), autor);
        return card;
      };
      const listas = SUCURSALES_RESENAS.map((s) => s.resenas.map((r) => ({ r, s })));
      const n = Math.max(...listas.map((l) => l.length));
      const originales = [];
      for (let k = 0; k < n; k++) listas.forEach((l) => { if (l[k]) originales.push(crearCard(l[k].r, l[k].s)); });
      const pista = fr.querySelector(".franja-pista");
      originales.forEach((c) => pista.append(c));
      originales.forEach((c) => { // pista ×2: los duplicados no se leen ni se enfocan
        const d = c.cloneNode(true);
        d.setAttribute("aria-hidden", "true");
        d.setAttribute("tabindex", "-1");
        pista.append(d);
      });
      pista.style.setProperty("--loop", originales.length * FRANJA_SEG_POR_TARJETA + "s");
      fr.hidden = false;
    }

    // ---------- b) ventanas con fotos ----------
    const sec = document.getElementById("opiniones");
    if (!sec) return;
    sec.querySelectorAll("[data-resena-suc]").forEach((a) => {
      const suc = SUCURSALES_RESENAS.find((s) => s.id === a.dataset.resenaSuc);
      if (suc) a.href = suc.mapsUrl; else a.hidden = true;
    });
    const strip = sec.querySelector(".opiniones-strip");
    strip.replaceChildren(...CLIENTES_FOTOS.map((f) => {
      const li = mk("li"), im = new Image();
      im.src = "assets/img/clientes/" + f; im.alt = "Cliente de Tecnolab retirando su equipo";
      im.width = 900; im.height = 900; im.loading = "lazy"; im.decoding = "async";
      li.append(im);
      return li;
    }));
    sec.hidden = false;

    const fxOk = !window.matchMedia("(prefers-reduced-motion: reduce)").matches && !window.matchMedia("(max-width: 768px)").matches; // en celular las fotos van en una grilla estática (sin capa animada) // el modo autónomo funciona también en táctil
    const capa = sec.querySelector(".opiniones-fx");
    if (!fxOk || !capa || !("IntersectionObserver" in window)) return;

    const FX = OPINIONES_FX;
    capa.style.setProperty("--fx-in", FX.entradaMs + "ms");
    capa.style.setProperty("--fx-out", FX.salidaMs + "ms");
    capa.style.setProperty("--fx-escala", FX.escalaInicial);
    let pool = null;            // [{ el, img, key, t, fase: 0 libre | 1 visible | 2 apagándose }]
    const ocupadas = new Map(); // "col,fila" → celda
    const recientes = [];
    let idx = Math.floor(Math.random() * CLIENTES_FOTOS.length);
    let activa = false, raf = 0, ptr = null, ultimaKey = "", proxAuto = 0;
    const tactil = window.matchMedia("(pointer: coarse)").matches; // en celular: menos fotos a la vez y más espaciadas (memoria de iOS)
    const intervaloAuto = FX.autoIntervalo * (tactil ? 4 : 1), maxAct = tactil ? Math.min(FX.maxActivas, 6) : FX.maxActivas;
    let cols = 1, lado = FX.celdaObjetivo, filas = 1, textos = [];

    // Grilla: columnas = round(ancho / objetivo), celda = ancho / columnas, filas = ceil(alto / celda).
    // El alto de la capa y el min-height de la sección valen filas × celda: la última fila queda completa.
    function layout() {
      sec.style.minHeight = ""; capa.style.height = "";
      const w = sec.clientWidth, h = sec.offsetHeight;
      cols = Math.max(1, Math.round(w / FX.celdaObjetivo));
      lado = w / cols;
      filas = Math.max(1, Math.ceil(h / lado));
      sec.style.minHeight = filas * lado + "px";
      capa.style.height = filas * lado + "px";
      capa.dataset.cols = cols; capa.dataset.filas = filas; capa.dataset.lado = lado;
      const sr = sec.getBoundingClientRect(), p = FX.margenTexto;
      textos = [...sec.querySelectorAll("[data-foto-evitar]")].filter((e) => !e.hidden).map((e) => {
        const r = e.getBoundingClientRect();
        return { l: r.left - sr.left - p, t: r.top - sr.top - p, r: r.right - sr.left + p, b: r.bottom - sr.top + p };
      });
      apagarTodo();
    }
    const tocaTexto = (col, fila) => {
      const l = col * lado + 4, t = fila * lado + 4, r = l + lado - 8, b = t + lado - 8;
      return textos.some((x) => l < x.r && r > x.l && t < x.b && b > x.t);
    };

    const montarPool = () => {
      pool = [];
      for (let i = 0; i < Math.max(FX.maxVisibles, maxAct + FX.poolExtra); i++) {
        const el = mk("div", "fx-cell");
        const img = new Image();
        img.alt = ""; img.loading = "lazy"; img.decoding = "async";
        el.append(img);
        capa.append(el);
        pool.push({ el, img, key: "", t: 0, fase: 0, perm: FX.permanenciaMs });
      }
      CLIENTES_FOTOS.forEach((f) => { const p = new Image(); p.src = "assets/img/clientes/" + f; }); // calienta la caché
    };
    const liberar = (c) => {
      c.el.classList.remove("is-in", "is-on");
      ocupadas.delete(c.key);
      c.key = ""; c.fase = 0;
    };
    const celdaLibre = () => {
      let peor = null;
      for (const c of pool) { if (c.fase === 0) return c; if (!peor || c.t < peor.t) peor = c; }
      // todas en uso: se recicla la más vieja, con corte seco (sin transición) para que no quede un destello a opacidad alta
      peor.el.style.transition = "none";
      liberar(peor);
      void peor.el.offsetWidth;
      peor.el.style.transition = "";
      return peor;
    };
    const siguienteFoto = () => { // rotativo; nunca una de las últimas FX.recientesSinRepetir
      const n = CLIENTES_FOTOS.length;
      for (let k = 1; k <= n; k++) {
        const i = (idx + k) % n;
        if (n <= FX.recientesSinRepetir || !recientes.includes(i)) { idx = i; break; }
      }
      recientes.push(idx);
      if (recientes.length > FX.recientesSinRepetir) recientes.shift();
      return idx;
    };
    const tocar = (col, fila, ahora, intensidad = 1, perm = FX.permanenciaMs) => {
      const key = col + "," + fila;
      let c = ocupadas.get(key);
      if (c) { c.t = ahora; c.fase = 1; c.el.classList.add("is-in"); return; } // visible o apagándose: se refresca con la misma foto
      c = celdaLibre();
      const w = lado - 8;
      c.el.style.width = c.el.style.height = w + "px";
      c.el.style.translate = (col * lado + 4) + "px " + (fila * lado + 4) + "px";
      c.el.style.setProperty("--fx-max", (tocaTexto(col, fila) ? FX.opacidadTexto : FX.opacidadMax) * intensidad);
      c.perm = perm;
      c.img.src = "assets/img/clientes/" + CLIENTES_FOTOS[siguienteFoto()];
      c.img.width = c.img.height = w;
      c.key = key; c.t = ahora; c.fase = 1;
      ocupadas.set(key, c);
      c.el.classList.add("is-on");
      void c.el.offsetWidth; // fija el estado inicial (opacity 0 / escala) antes de entrar
      c.el.classList.add("is-in");
    };
    const tick = (ahora) => {
      raf = 0;
      if (!activa || document.hidden) return; // en segundo plano no corre; visibilitychange lo reanuda
      if (ahora >= proxAuto) { proxAuto = ahora + intervaloAuto; lanzarAuto(); } // modo autónomo dentro del mismo loop (sin setTimeout)
      if (ptr) {
        const rect = sec.getBoundingClientRect();
        const col = Math.min(cols - 1, Math.floor((ptr.x - rect.left) / lado));
        const fila = Math.floor((ptr.y - rect.top) / lado);
        ptr = null;
        const key = col + "," + fila;
        if (col >= 0 && fila >= 0 && fila < filas && key !== ultimaKey) { ultimaKey = key; tocar(col, fila, ahora); }
      }
      let vivas = false;
      for (const c of pool) {
        if (c.fase === 0) continue;
        vivas = true;
        const edad = ahora - c.t;
        if (c.fase === 1 && edad > c.perm) { c.fase = 2; c.el.classList.remove("is-in"); }
        else if (c.fase === 2 && edad > c.perm + FX.salidaMs) liberar(c);
      }
      raf = requestAnimationFrame(tick); // sigue mientras la sección esté visible
    };
    const mover = (e) => {
      if (e.pointerType !== "mouse") return;
      ptr = { x: e.clientX, y: e.clientY };
      if (!raf) raf = requestAnimationFrame(tick);
    };
    // Modo autónomo: una foto cada autoIntervalo ms en una celda al azar, sin repetir la anterior ni tocar una vecina de otra visible
    let ultimaAuto = "";
    const lanzarAuto = () => {
      if (!activa) return;
      if (pool.filter((c) => c.fase).length < maxAct) {
        const vivas = [...ocupadas.keys()].map((k) => k.split(",").map(Number));
        for (let i = 0; i < cols * filas; i++) {
          const col = Math.floor(Math.random() * cols), fila = Math.floor(Math.random() * filas), key = col + "," + fila;
          if (key === ultimaAuto || ocupadas.has(key) || vivas.some(([c, f]) => Math.abs(c - col) <= 1 && Math.abs(f - fila) <= 1)) continue;
          ultimaAuto = key;
          const k = Math.random(); // 0 = tenue y larga, 1 = nítida y corta
          tocar(col, fila, performance.now(), FX.intensidadMin + k * (FX.intensidadMax - FX.intensidadMin), FX.autoPermMax - k * (FX.autoPermMax - FX.autoPermMin));
          break;
        }
      }
    };
    function apagarTodo() { if (pool) pool.forEach((c) => { if (c.fase) liberar(c); }); ultimaKey = ""; ultimaAuto = ""; ptr = null; }

    layout();
    let td = 0;
    window.addEventListener("resize", () => { clearTimeout(td); td = setTimeout(layout, FX.resizeDebounceMs); });
    window.addEventListener("load", layout, { once: true });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(layout);

    window.addEventListener("tl-fx-reanudar", () => { if (activa && !raf) raf = requestAnimationFrame(tick); });
    new IntersectionObserver((entradas) => {
      const dentro = entradas[entradas.length - 1].isIntersecting;
      if (dentro && !activa) {
        if (!pool) montarPool();
        activa = true;
        sec.addEventListener("pointermove", mover, { passive: true });
        proxAuto = 0;
        if (!raf) raf = requestAnimationFrame(tick); // arranque inmediato
      } else if (!dentro && activa) {
        activa = false;
        sec.removeEventListener("pointermove", mover);
        if (raf) { cancelAnimationFrame(raf); raf = 0; }
        apagarTodo();
      }
    }, { threshold: 0 }).observe(sec);
  }
  document.addEventListener("visibilitychange", () => { if (!document.hidden) window.dispatchEvent(new Event("tl-fx-reanudar")); });
  try { initOpiniones(); } catch (e) { /* mejora secundaria */ }

  /* ============================================================
     HORARIOS DE SUCURSAL — en cada tarjeta [data-sucursal] (Home y Nosotros): resumen legible de tres líneas,
     indicador «Abierto ahora» / «Cerrado» junto al nombre (hora de Mendoza, se actualiza una vez por minuto),
     detalle de ubicación y teléfono si está confirmado. Datos: SUCURSALES en js/config.js.
     Si el cálculo de la hora falla, se oculta el indicador y queda solo el horario.
     ============================================================ */
  function initHorarios() {
    if (typeof SUCURSALES === "undefined") return;
    const DIAS = ["lun", "mar", "mie", "jue", "vie", "sab", "dom"];
    const ETIQ = { lun: "Lun", mar: "Mar", mie: "Mié", jue: "Jue", vie: "Vie", sab: "Sáb", dom: "Dom" };
    const aMin = (hhmm) => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; };
    const tramo = (t) => { const [a, b] = t.split("–"); return [aMin(a), aMin(b)]; };
    const hora = (hhmm) => { const [h, m] = hhmm.split(":").map(Number); return m ? h + ":" + String(m).padStart(2, "0") : String(h); };
    const firmaDia = (suc, d) => (suc.horarios[d] || []).join("|");

    // «Lun a vie 10 a 14 y 15 a 19» / «Sáb 10 a 13» / «Dom cerrado»: agrupa días seguidos con el mismo horario
    function resumen(suc) {
      const lineas = [];
      for (let i = 0; i < DIAS.length;) {
        let j = i;
        while (j + 1 < DIAS.length && firmaDia(suc, DIAS[j + 1]) === firmaDia(suc, DIAS[i])) j++;
        const rotulo = i === j ? ETIQ[DIAS[i]] : ETIQ[DIAS[i]] + " a " + ETIQ[DIAS[j]].toLowerCase();
        const tr = suc.horarios[DIAS[i]] || [];
        const texto = tr.length ? tr.map((t) => { const [a, b] = t.split("–"); return hora(a) + " a " + hora(b); }).join(" y ") : "cerrado";
        lineas.push(rotulo + " " + texto);
        i = j + 1;
      }
      return lineas;
    }

    // Día y minutos actuales en la zona de la sucursal; lanza si el navegador no soporta la zona
    function ahoraEn(zona) {
      const partes = new Intl.DateTimeFormat("en-US", { timeZone: zona, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
      const get = (t) => partes.find((p) => p.type === t).value;
      const dia = { Mon: "lun", Tue: "mar", Wed: "mie", Thu: "jue", Fri: "vie", Sat: "sab", Sun: "dom" }[get("weekday")];
      const min = Number(get("hour")) * 60 + Number(get("minute"));
      if (!dia || Number.isNaN(min)) throw new Error("hora inválida");
      return { dia, min };
    }
    const abierto = (suc) => {
      const { dia, min } = ahoraEn(suc.zona);
      return (suc.horarios[dia] || []).some((t) => { const [a, b] = tramo(t); return min >= a && min < b; });
    };

    const tarjetas = [];
    document.querySelectorAll("[data-sucursal]").forEach((card) => {
      const suc = SUCURSALES[card.dataset.sucursal];
      if (!suc) return;
      const nombre = card.querySelector(".branch-map-name, .branch-lite-name");
      const dir = card.querySelector(".branch-map-address, .branch-lite-address");
      if (!nombre || !dir) return;
      let ancla = dir;
      if (suc.detalle) { // p. ej. «Lomas Plaza Comercial» debajo de la dirección
        const d = document.createElement("span");
        d.className = "branch-detalle";
        d.textContent = suc.detalle;
        ancla.after(d); ancla = d;
      }
      const ul = document.createElement("ul");
      ul.className = "branch-horario";
      ul.setAttribute("aria-label", "Horarios de atención");
      resumen(suc).forEach((l) => { const li = document.createElement("li"); li.textContent = l; ul.append(li); });
      ancla.after(ul); ancla = ul;
      if (suc.telefono) { // null = sin confirmar: no se muestra
        const a = document.createElement("a");
        a.className = "branch-tel";
        a.href = "tel:+54" + suc.telefono.replace(/\D/g, "").replace(/^0/, "");
        a.textContent = suc.telefono;
        ancla.after(a);
      }
      const estado = document.createElement("span");
      estado.className = "branch-estado";
      estado.hidden = true;
      nombre.append(estado);
      tarjetas.push({ suc, estado });
    });
    if (!tarjetas.length) return;

    function actualizar() {
      tarjetas.forEach(({ suc, estado }) => {
        try {
          const ab = abierto(suc);
          estado.textContent = ab ? "Abierto ahora" : "Cerrado";
          estado.dataset.abierto = ab ? "1" : "0";
          estado.hidden = false;
        } catch {
          estado.hidden = true; // si falla el cálculo, queda solo el horario
        }
      });
    }
    actualizar();
    // una vez por minuto, alineado al cambio de minuto
    const programar = () => setTimeout(() => { actualizar(); setInterval(actualizar, 60000); }, 60000 - (Date.now() % 60000) + 50);
    programar();
    document.addEventListener("visibilitychange", () => { if (!document.hidden) actualizar(); });
  }
  try { initHorarios(); } catch (e) { /* mejora secundaria: un error aquí no corta el resto */ }

  /* Foto opcional del hero (assets/images/hero-product.png): si carga, el hero pasa a dos columnas; si no existe, se quita.
     Va con listeners (la CSP no permite onload/onerror en línea). El evento puede haber pasado antes de que corra este script. */
  try {
    const heroImg = document.querySelector(".hero-product-img");
    if (heroImg) {
      const ok = () => { const h = heroImg.closest(".hero"); if (h) h.classList.add("has-product"); };
      const mal = () => heroImg.remove();
      heroImg.addEventListener("load", ok, { once: true });
      heroImg.addEventListener("error", mal, { once: true });
      if (heroImg.complete) { if (heroImg.naturalWidth > 0) ok(); else mal(); }
    }
  } catch (e) { /* mejora secundaria */ }

});
