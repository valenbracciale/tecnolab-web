/**
 * Panel de administración de productos (admin.html). Toda lectura y escritura pasa por el cliente de Supabase con la
 * sesión de quien entró: la protección real es la RLS (solo "authenticated" escribe). Nada de lo que viene de la base se
 * inserta como HTML: todo se arma con textContent / setAttribute.
 */
(function () {
  "use strict";

  const BUCKET = "productos";
  const MAX_LADO = 1600, CALIDAD = 0.82;
  const MAX_ORIGINAL = 25 * 1024 * 1024; // foto de origen (se achica antes de subir)
  const MAX_SUBIDA = 5 * 1024 * 1024;    // límite del bucket
  const TIPOS = ["image/jpeg", "image/png", "image/webp"];
  const EXTS = ["jpg", "jpeg", "png", "webp"];
  const NUEVA = "__nueva__";
  const COLUMNAS = "id,categoria,subcategoria,nombre,variante,especificacion,precio_num,precio_texto,regalo,disponible,orden,fotos,colores";
  const fmt = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });

  const $ = (id) => document.getElementById(id);
  function h(tag, props, ...hijos) {
    const n = document.createElement(tag);
    Object.keys(props || {}).forEach((k) => {
      const v = props[k];
      if (v === false || v == null) return;
      if (k === "text") n.textContent = v;
      else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? "" : v);
    });
    hijos.flat().forEach((c) => c && n.append(c));
    return n;
  }

  let sb = null;
  let productos = [];
  let cargado = false;
  let ed = null; // estado del editor

  /* ---------------------------------------------------------------- utilidades */
  const norm = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const slug = (t) => norm(t).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "producto";
  const precioTxt = (n) => "$" + fmt.format(n);
  // Solo se muestran imágenes de nuestro Storage o de assets/img (las que ya trae el sitio)
  function srcSeguro(u) {
    const s = String(u || "");
    if (s.startsWith(SUPABASE_URL + "/storage/") || /^assets\/img\/[\w./-]+$/.test(s)) return s;
    return "";
  }
  function fotoPrincipal(p) {
    const fs = Array.isArray(p.fotos) ? p.fotos.filter((f) => f && f.url) : [];
    const f = fs.find((x) => x.principal) || fs[0];
    if (f) return f.url;
    const c = Array.isArray(p.colores) && p.colores[0];
    return c && c.imagen ? c.imagen : "";
  }
  let toastT = 0;
  function aviso(msg) {
    const t = $("adm-toast");
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastT);
    toastT = setTimeout(() => { t.hidden = true; }, 3500);
  }
  function mostrarError(el, msg) { el.textContent = msg || ""; el.hidden = !msg; }

  /* ---------------------------------------------------------------- confirmaciones */
  // confirmar({ titulo, texto, ok, escribir }) → Promise<boolean>. Con `escribir`, hay que tipear esa palabra para habilitar «ok».
  function confirmar({ titulo, texto, ok = "Aceptar", escribir = "" }) {
    return new Promise((resolve) => {
      const d = $("adm-confirm"), si = $("adm-confirm-si"), no = $("adm-confirm-no"), inp = $("adm-confirm-input");
      $("adm-confirm-titulo").textContent = titulo;
      $("adm-confirm-texto").textContent = texto;
      si.textContent = ok;
      const caja = $("adm-confirm-escribir");
      caja.hidden = !escribir;
      inp.value = "";
      $("adm-confirm-input-rotulo").textContent = escribir ? "Escribí " + escribir + " para confirmar" : "";
      si.disabled = !!escribir;
      const valida = () => { si.disabled = !!escribir && inp.value.trim().toUpperCase() !== escribir; };
      const fin = (r) => { si.onclick = no.onclick = inp.oninput = null; d.onclose = null; if (d.open) d.close(); resolve(r); };
      si.onclick = () => fin(true);
      no.onclick = () => fin(false);
      inp.oninput = valida;
      d.onclose = () => fin(false); // Esc
      d.showModal();
      (escribir ? inp : no).focus();
    });
  }

  /* ---------------------------------------------------------------- acceso */
  function vista(conSesion) {
    $("adm-login").hidden = conSesion;
    $("adm-app").hidden = !conSesion;
    if (!conSesion) {
      cargado = false; productos = []; ed = null;
      const e = $("adm-editor"); if (e.open) e.close();
      $("adm-lista").replaceChildren();
    }
  }
  function sesion(s) {
    vista(!!s);
    if (s && !cargado) { cargado = true; setTimeout(cargar, 0); } // fuera del callback de auth (evita bloqueos del cliente)
  }

  async function entrar(e) {
    e.preventDefault();
    const err = $("adm-login-error"), btn = $("adm-login-btn");
    mostrarError(err, "");
    const email = $("adm-email").value.trim(), pass = $("adm-pass").value;
    if (!email || !pass) { mostrarError(err, "Email o contraseña incorrectos."); return; }
    btn.disabled = true;
    try {
      const { error } = await sb.auth.signInWithPassword({ email, password: pass });
      if (error) mostrarError(err, "Email o contraseña incorrectos.");
      else $("adm-pass").value = "";
    } catch (x) { mostrarError(err, "No pudimos conectar. Probá de nuevo."); }
    btn.disabled = false;
  }

  /* ---------------------------------------------------------------- lista */
  async function cargar() {
    $("adm-estado").textContent = "Cargando productos…";
    const { data, error } = await sb.from("productos").select(COLUMNAS).order("orden", { ascending: true });
    if (error) {
      $("adm-estado").textContent = "No pudimos cargar los productos. Tocá “Salir” y volvé a entrar, o probá de nuevo en un rato.";
      cargado = false;
      return;
    }
    productos = data || [];
    llenarFiltro();
    pintarLista();
  }
  const categorias = () => [...new Set(productos.map((p) => p.categoria).filter(Boolean))];
  function llenarFiltro() {
    const sel = $("adm-filtro-cat"), v = sel.value;
    sel.replaceChildren(h("option", { value: "", text: "Todas las categorías" }), ...categorias().map((c) => h("option", { value: c, text: c })));
    sel.value = categorias().includes(v) ? v : "";
  }
  function pintarLista() {
    const q = norm($("adm-buscar").value.trim()), cat = $("adm-filtro-cat").value;
    const vis = productos.filter((p) => (!cat || p.categoria === cat) && (!q || norm([p.nombre, p.variante, p.categoria, p.subcategoria].join(" ")).includes(q)));
    $("adm-estado").textContent = productos.length ? vis.length + " de " + productos.length + " productos" : "Todavía no hay productos.";
    $("adm-lista").replaceChildren(...vis.map((p) => {
      const src = srcSeguro(fotoPrincipal(p));
      const thumb = src ? h("img", { class: "adm-thumb", src, alt: "", width: "56", height: "56", loading: "lazy", decoding: "async" }) : h("span", { class: "adm-thumb", "aria-hidden": "true", text: "Sin foto" });
      const precio = Number.isFinite(Number(p.precio_num)) && p.precio_num !== null ? precioTxt(p.precio_num) : (p.precio_texto || "Consultar");
      return h("li", {}, h("button", { type: "button", class: "adm-row", "data-id": p.id, onclick: () => abrirEditor(p) },
        thumb,
        h("span", {},
          h("span", { class: "adm-row-nombre", text: p.nombre + (p.variante ? " · " + p.variante : "") }),
          h("span", { class: "adm-row-meta" },
            h("span", { text: [p.categoria, p.subcategoria].filter(Boolean).join(" › ") }),
            h("span", { class: "adm-row-precio", text: precio }),
            p.regalo ? h("span", { class: "adm-badge adm-badge--regalo", text: "Regalo" }) : null,
            p.disponible === false ? h("span", { class: "adm-badge adm-badge--stock", text: "Sin stock" }) : null))));
    }));
  }

  /* ---------------------------------------------------------------- editor */
  function llenarCategorias(valor) {
    const sel = $("f-categoria");
    sel.replaceChildren(h("option", { value: "", text: "Elegí una categoría" }), ...categorias().map((c) => h("option", { value: c, text: c })), h("option", { value: NUEVA, text: "+ Crear categoría nueva" }));
    sel.value = valor && categorias().includes(valor) ? valor : "";
    $("f-categoria-nueva").hidden = true;
    $("f-categoria-nueva").value = "";
  }
  function abrirEditor(p) {
    const nuevo = !p;
    ed = {
      nuevo, id: nuevo ? "" : p.id, orig: p || null, ocupado: false, sucio: false,
      fotos: nuevo ? [] : (Array.isArray(p.fotos) ? p.fotos.filter((f) => f && f.url).map((f) => ({ url: f.url, path: f.path || null, principal: f.principal === true })) : []),
      subidas: new Set()
    };
    asegurarPrincipal();
    $("adm-editor-titulo").textContent = nuevo ? "Agregar producto" : "Editar producto";
    llenarCategorias(nuevo ? "" : p.categoria);
    $("f-nombre").value = nuevo ? "" : p.nombre || "";
    $("f-subcategoria").value = nuevo ? "" : p.subcategoria || "";
    $("f-variante").value = nuevo ? "" : p.variante || "";
    $("f-especificacion").value = nuevo ? "" : p.especificacion || "";
    $("f-precio").value = !nuevo && p.precio_num !== null && Number.isFinite(Number(p.precio_num)) ? precioTxt(p.precio_num) : "";
    $("f-regalo").checked = nuevo ? false : p.regalo === true;
    $("f-disponible").checked = nuevo ? true : p.disponible !== false;
    $("adm-eliminar").hidden = nuevo;
    const nota = $("adm-nota");
    const cols = !nuevo && Array.isArray(p.colores) ? p.colores : [];
    const conImg = cols.filter((c) => c && c.imagen).length;
    nota.textContent = cols.length < 2 ? ""
      : conImg === 0 ? "Este producto tiene varios colores sin foto propia: el sitio muestra las fotos de acá (la principal primero) y elegir un color no cambia la imagen."
      : conImg === cols.length ? "Cada color usa su propia foto: las fotos de acá no se muestran en el sitio."
      : "Los colores con foto propia usan esa foto; los que no tienen, usan la foto principal de acá.";
    nota.hidden = !nota.textContent;
    mostrarError($("adm-form-error"), "");
    pintarFotos();
    $("adm-guardar").disabled = false;
    $("adm-editor").showModal();
    $("f-nombre").focus();
  }
  function asegurarPrincipal() {
    if (ed.fotos.length && !ed.fotos.some((f) => f.principal)) ed.fotos[0].principal = true;
    let vista = false;
    ed.fotos.forEach((f) => { if (f.principal) { if (vista) f.principal = false; vista = true; } });
  }

  // Cierra sin guardar: borra del Storage lo que se subió en esta sesión y no quedó guardado
  async function limpiarSubidas() {
    const paths = [...ed.subidas];
    ed.subidas.clear();
    if (paths.length) await sb.storage.from(BUCKET).remove(paths).catch(() => {});
  }
  async function cerrarEditor(forzar) {
    if (!ed) return;
    if (ed.ocupado) return;
    if (!forzar && ed.sucio && !(await confirmar({ titulo: "¿Descartar los cambios?", texto: "Lo que cambiaste y no guardaste se pierde.", ok: "Descartar" }))) return;
    if (!forzar) await limpiarSubidas();
    $("adm-editor").close();
    ed = null;
  }

  /* -- precio con formato $1.850.000 -- */
  function formatearPrecioInput() {
    const i = $("f-precio"), d = i.value.replace(/\D/g, "").slice(0, 12);
    i.value = d ? precioTxt(Number(d)) : "";
  }
  const precioNum = () => { const d = $("f-precio").value.replace(/\D/g, ""); return d ? Number(d) : null; };

  /* -- fotos -- */
  function pintarFotos(subiendo) {
    const ul = $("adm-fotos");
    ul.replaceChildren(...ed.fotos.map((f, i) => {
      const src = srcSeguro(f.url);
      return h("li", { class: "adm-foto" + (f.principal ? " is-principal" : "") },
        src ? h("img", { src, alt: "Foto " + (i + 1) + " de " + ($("f-nombre").value.trim() || "producto"), width: "130", height: "130", loading: "lazy", decoding: "async" }) : h("span", { class: "adm-foto-subiendo", text: "Sin vista" }),
        h("button", { type: "button", class: "adm-btn " + (f.principal ? "adm-btn--primary" : "adm-btn--outline"), "aria-pressed": String(f.principal), onclick: () => { ed.fotos.forEach((x) => { x.principal = x === f; }); ed.sucio = true; pintarFotos(); } }, f.principal ? "★ Principal" : "Marcar principal"),
        h("button", { type: "button", class: "adm-btn adm-btn--outline", onclick: () => quitarFoto(f) }, "Quitar"));
    }), ...(subiendo ? Array.from({ length: subiendo }, () => h("li", { class: "adm-foto" }, h("span", { class: "adm-foto-subiendo", text: "Subiendo…" }))) : []));
  }
  async function idLibre() {
    if (ed.id) return ed.id;
    const base = slug($("f-nombre").value);
    for (let n = 1; n < 50; n++) {
      const cand = n === 1 ? base : base + "-" + n;
      if (productos.some((p) => p.id === cand)) continue;
      const { data, error } = await sb.from("productos").select("id").eq("id", cand).maybeSingle();
      if (error) throw error;
      if (!data) { ed.id = cand; return cand; }
    }
    throw new Error("sin id");
  }
  async function aWebp(file) {
    const ext = (file.name.split(".").pop() || "").toLowerCase();
    if (!TIPOS.includes(file.type) || !EXTS.includes(ext)) throw new Error("“" + file.name + "”: solo se aceptan fotos JPG, PNG o WebP.");
    if (file.size > MAX_ORIGINAL) throw new Error("“" + file.name + "” pesa demasiado (máximo 25 MB).");
    let bmp;
    try { bmp = await createImageBitmap(file, { imageOrientation: "from-image" }); } catch (e) { throw new Error("“" + file.name + "” no se pudo leer como imagen."); }
    const k = Math.min(1, MAX_LADO / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(bmp.width * k));
    c.height = Math.max(1, Math.round(bmp.height * k));
    c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
    if (bmp.close) bmp.close();
    const blob = await new Promise((r) => c.toBlob(r, "image/webp", CALIDAD));
    if (!blob || blob.type !== "image/webp") throw new Error("Este navegador no puede preparar las fotos. Probá con Chrome o Safari actualizado.");
    if (blob.size > MAX_SUBIDA) throw new Error("“" + file.name + "” sigue pesando más de 5 MB después de achicarla.");
    return blob;
  }
  async function subirFotos(files) {
    const errEl = $("adm-form-error");
    mostrarError(errEl, "");
    files = [...files];
    if (!files.length || !ed) return;
    if (!$("f-nombre").value.trim()) { mostrarError(errEl, "Primero escribí el nombre del producto, después sumá las fotos."); return; }
    ed.ocupado = true;
    $("adm-guardar").disabled = true;
    pintarFotos(files.length);
    const fallas = [];
    try {
      const id = await idLibre();
      for (const f of files) {
        try {
          const blob = await aWebp(f);
          const r = crypto.getRandomValues(new Uint32Array(1))[0].toString(36);
          const path = id + "/" + Date.now().toString(36) + "-" + r + ".webp";
          const { error } = await sb.storage.from(BUCKET).upload(path, blob, { contentType: "image/webp", cacheControl: "31536000", upsert: false });
          if (error) throw new Error("No se pudo subir “" + f.name + "”. Probá de nuevo.");
          const url = sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
          ed.fotos.push({ url, path, principal: false });
          ed.subidas.add(path);
          ed.sucio = true;
        } catch (x) { fallas.push(x.message); }
      }
    } catch (x) { fallas.push("No pudimos preparar la subida. Probá de nuevo."); }
    asegurarPrincipal();
    ed.ocupado = false;
    $("adm-guardar").disabled = false;
    pintarFotos();
    if (fallas.length) mostrarError(errEl, fallas.join(" "));
  }
  async function persistirFotos() { // producto ya existente: deja la base al día sin esperar a «Guardar»
    const { data, error } = await sb.from("productos").update({ fotos: ed.fotos }).eq("id", ed.id).select("id");
    if (error || !data || !data.length) throw new Error("No se pudo actualizar las fotos.");
    const p = productos.find((x) => x.id === ed.id); if (p) p.fotos = ed.fotos.map((f) => ({ ...f }));
    ed.fotos.forEach((f) => f.path && ed.subidas.delete(f.path));
  }
  async function quitarFoto(f) {
    const errEl = $("adm-form-error");
    if (!(await confirmar({ titulo: "¿Quitar esta foto?", texto: f.path ? "Se borra del sitio y del almacenamiento. No se puede deshacer." : "Se saca del producto.", ok: "Quitar foto" }))) return;
    mostrarError(errEl, "");
    ed.ocupado = true;
    try {
      if (f.path) {
        const { error } = await sb.storage.from(BUCKET).remove([f.path]);
        if (error) throw new Error("No se pudo borrar el archivo. Probá de nuevo.");
        ed.subidas.delete(f.path);
      }
      ed.fotos = ed.fotos.filter((x) => x !== f);
      asegurarPrincipal();
      if (!ed.nuevo) await persistirFotos();
      else ed.sucio = true;
      aviso("Foto quitada");
    } catch (x) { mostrarError(errEl, x.message); }
    ed.ocupado = false;
    pintarFotos();
  }

  /* -- guardar -- */
  function leerFormulario() {
    const sel = $("f-categoria").value;
    const categoria = (sel === NUEVA ? $("f-categoria-nueva").value : sel).trim();
    const nombre = $("f-nombre").value.trim();
    if (!nombre) return { error: "El nombre es obligatorio." };
    if (!categoria) return { error: "Elegí una categoría (o creá una nueva)." };
    const n = precioNum();
    if (n !== null && (!Number.isFinite(n) || n < 0)) return { error: "El precio no puede ser negativo." };
    const previo = ed.orig && typeof ed.orig.precio_texto === "string" ? ed.orig.precio_texto : "";
    const desde = /^Desde\s/i.test(previo) && ed.orig && Number(ed.orig.precio_num) === n ? "Desde " : "";
    // Si no cambió el precio, se conserva el texto original (ej. «Desde $1.850.000»)
    const texto = ed.orig && Number(ed.orig.precio_num) === n && n !== null && previo ? previo : n === null ? "Consultar" : desde + precioTxt(n);
    return {
      fila: {
        nombre, categoria,
        subcategoria: $("f-subcategoria").value.trim() || null,
        variante: $("f-variante").value.trim() || null,
        especificacion: $("f-especificacion").value.trim() || null,
        precio_num: n, precio_texto: texto,
        regalo: $("f-regalo").checked, disponible: $("f-disponible").checked,
        fotos: ed.fotos.map((f) => ({ url: f.url, path: f.path, principal: f.principal === true }))
      }
    };
  }
  function siguienteOrden(cat) {
    const acc = cat === "Accesorios";
    const ords = productos.filter((p) => (p.categoria === "Accesorios") === acc).map((p) => Number(p.orden)).filter(Number.isFinite);
    return ords.length ? Math.max(...ords) + 1 : acc ? 1000 : 0;
  }
  async function guardar(e) {
    e.preventDefault();
    if (!ed || ed.ocupado) return;
    const errEl = $("adm-form-error");
    mostrarError(errEl, "");
    const r = leerFormulario();
    if (r.error) { mostrarError(errEl, r.error); return; }
    const btn = $("adm-guardar");
    ed.ocupado = true; btn.disabled = true; btn.textContent = "Guardando…";
    try {
      asegurarPrincipal();
      r.fila.fotos = ed.fotos.map((f) => ({ url: f.url, path: f.path, principal: f.principal === true }));
      let fila;
      if (ed.nuevo) {
        const id = await idLibre();
        const { data, error } = await sb.from("productos").insert({ ...r.fila, id, orden: siguienteOrden(r.fila.categoria), destacado: false, oferta: false, colores: [] }).select(COLUMNAS);
        if (error) throw error;
        if (!data || !data.length) throw new Error("vacío");
        fila = data[0]; productos.push(fila);
      } else {
        const { data, error } = await sb.from("productos").update(r.fila).eq("id", ed.id).select(COLUMNAS);
        if (error) throw error;
        if (!data || !data.length) throw new Error("vacío");
        fila = data[0]; productos = productos.map((p) => (p.id === fila.id ? fila : p));
      }
      ed.subidas.clear();
      try { sessionStorage.removeItem("tecnolab_productos_v1"); } catch (x) { /* sin sessionStorage */ }
      llenarFiltro(); pintarLista();
      ed.ocupado = false; ed.sucio = false;
      await cerrarEditor(true);
      aviso("Guardado ✓");
    } catch (x) {
      ed.ocupado = false;
      mostrarError(errEl, x && x.code === "23505" ? "Ya existe un producto con ese nombre. Cambiale el nombre o la variante." : "No se pudo guardar. Revisá tu conexión y probá de nuevo. Si sigue, salí y volvé a entrar.");
    }
    if (ed) { btn.disabled = false; }
    btn.textContent = "Guardar";
  }

  /* -- eliminar (dos pasos) -- */
  async function eliminar() {
    if (!ed || ed.nuevo || ed.ocupado) return;
    const p = ed.orig, errEl = $("adm-form-error");
    if (!(await confirmar({ titulo: "¿Eliminar “" + p.nombre + "”?", texto: "Se saca del sitio junto con todas sus fotos.", ok: "Seguir" }))) return;
    if (!(await confirmar({ titulo: "Última confirmación", texto: "Esta acción no se puede deshacer.", ok: "Eliminar para siempre", escribir: "ELIMINAR" }))) return;
    ed.ocupado = true;
    $("adm-eliminar").disabled = true;
    try {
      const { data, error } = await sb.from("productos").delete().eq("id", p.id).select("id");
      if (error || !data || !data.length) throw new Error("No se pudo eliminar. Probá de nuevo.");
      // Fotos del Storage: las guardadas en la fila y cualquier resto de su carpeta (mejor esfuerzo)
      const paths = new Set((Array.isArray(p.fotos) ? p.fotos : []).map((f) => f && f.path).filter(Boolean));
      ed.fotos.forEach((f) => f.path && paths.add(f.path));
      try {
        const l = await sb.storage.from(BUCKET).list(p.id, { limit: 100 });
        (l.data || []).forEach((o) => paths.add(p.id + "/" + o.name));
        if (paths.size) await sb.storage.from(BUCKET).remove([...paths]);
      } catch (x) { /* queda un archivo suelto: no afecta al sitio */ }
      productos = productos.filter((x) => x.id !== p.id);
      try { sessionStorage.removeItem("tecnolab_productos_v1"); } catch (x) { /* nada */ }
      llenarFiltro(); pintarLista();
      ed.ocupado = false; ed.sucio = false;
      await cerrarEditor(true);
      aviso("Producto eliminado");
    } catch (x) { mostrarError(errEl, x.message); ed.ocupado = false; }
    $("adm-eliminar").disabled = false;
  }

  /* ---------------------------------------------------------------- arranque */
  function iniciar() {
    if (!window.supabase || typeof SUPABASE_URL === "undefined" || typeof SUPABASE_ANON_KEY === "undefined") {
      vista(false);
      mostrarError($("adm-login-error"), "No se pudo cargar el panel. Recargá la página.");
      return;
    }
    sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true } });
    $("adm-login-form").addEventListener("submit", entrar);
    $("adm-salir").addEventListener("click", () => { sb.auth.signOut(); });
    $("adm-buscar").addEventListener("input", pintarLista);
    $("adm-filtro-cat").addEventListener("change", pintarLista);
    $("adm-agregar").addEventListener("click", () => abrirEditor(null));
    $("adm-form").addEventListener("submit", guardar);
    $("adm-eliminar").addEventListener("click", eliminar);
    $("adm-editor-cerrar").addEventListener("click", () => cerrarEditor(false));
    $("adm-editor").addEventListener("cancel", (e) => { e.preventDefault(); cerrarEditor(false); }); // Esc
    $("adm-form").addEventListener("input", () => { if (ed) ed.sucio = true; });
    $("f-precio").addEventListener("input", formatearPrecioInput);
    $("f-categoria").addEventListener("change", (e) => {
      const nueva = e.target.value === NUEVA, i = $("f-categoria-nueva");
      i.hidden = !nueva;
      if (nueva) i.focus();
    });
    const archivos = $("f-archivos"), drop = $("adm-drop");
    archivos.addEventListener("change", () => { const fs = [...archivos.files]; archivos.value = ""; subirFotos(fs); });
    ["dragenter", "dragover"].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add("is-over"); }));
    ["dragleave", "drop"].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.remove("is-over"); }));
    drop.addEventListener("drop", (e) => subirFotos(e.dataTransfer ? e.dataTransfer.files : []));
    sb.auth.onAuthStateChange((_evento, s) => sesion(s));
    sb.auth.getSession().then(({ data }) => sesion(data.session));
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
  else iniciar();
})();
