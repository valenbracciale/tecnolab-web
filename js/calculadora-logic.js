/**
 * Lógica PURA de la calculadora de Plan Canje (sin DOM, sin estado global, SIN valores de toma).
 * El cálculo del valor lo hace el servidor (webhook de n8n): acá solo hay validaciones del formulario,
 * el armado del mensaje de WhatsApp y el formato de montos.
 * Se usa en el navegador (window.CalculadoraCanje) y en Node.
 * La interfaz vive en js/main.js (initCalculadora). Las opciones de modelos: js/canje-opciones.js.
 *
 * opciones = CANJE_OPCIONES { modelos: [ { id, nombre, capacidades: [gb, ...] } ] }
 * entrada  = { modeloId, gb, bateria, detalles, detallesTexto, modeloTexto, nombre, whatsapp, consentimiento }
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.CalculadoraCanje = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var NO_LISTADO = "__no-listado";

  // Mensajes para los errores que devuelve el servidor (ok: false)
  var MENSAJES_SERVIDOR = {
    whatsapp: "Revisá tu WhatsApp: con código de área, sin 0 ni 15. Ej: 261 4699026.",
    nombre: "Escribí tu nombre.",
    consentimiento: "Necesitamos tu autorización para contactarte."
  };

  function formatearMonto(moneda, n) {
    var num = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(n);
    return (moneda || "USD") + " " + num;
  }

  function buscarModelo(opciones, id) {
    return (opciones.modelos || []).find(function (m) { return m.id === id; }) || null;
  }

  // Batería: "" / null / undefined → null (sin informar); entero 1–100 → número; otra cosa → NaN
  function parsearBateria(raw) {
    if (raw === null || raw === undefined || String(raw).trim() === "") return null;
    var n = Number(raw);
    return Number.isInteger(n) && n >= 1 && n <= 100 ? n : NaN;
  }

  // WhatsApp argentino: 10 dígitos (código de área + número) tras quitar espacios, guiones, +54, 9 y 0 inicial
  // (mismo criterio y mismo orden que el servidor).
  function digitosWhatsapp(raw) {
    return String(raw || "").replace(/\D/g, "").replace(/^54/, "").replace(/^9/, "").replace(/^0/, "");
  }

  /** Errores del formulario por campo ({} = válido). */
  function validarFormulario(opciones, entrada) {
    var errores = {};
    var noListado = entrada.modeloId === NO_LISTADO;
    var modelo = buscarModelo(opciones, entrada.modeloId);
    if (!noListado) {
      if (!modelo) errores.modelo = "Elegí un modelo.";
      else if (modelo.capacidades.indexOf(Number(entrada.gb)) === -1) errores.capacidad = "Elegí una capacidad.";
      var bateria = parsearBateria(entrada.bateria);
      if (Number.isNaN(bateria) || (bateria === null && !entrada.detalles)) errores.bateria = "Ingresá un porcentaje entre 1 y 100.";
    } else if (!String(entrada.modeloTexto || "").trim()) {
      errores.modeloTexto = "Escribí qué modelo es.";
    }
    if (String(entrada.nombre || "").trim().length < 2) errores.nombre = MENSAJES_SERVIDOR.nombre;
    if (digitosWhatsapp(entrada.whatsapp).length !== 10) errores.whatsapp = MENSAJES_SERVIDOR.whatsapp;
    if (entrada.consentimiento !== true) errores.consentimiento = MENSAJES_SERVIDOR.consentimiento;
    return errores;
  }

  /** Texto del mensaje de WhatsApp (sin codificar). `modelo` null = modelo no listado. */
  function mensajeWhatsApp(modelo, entrada, bateria, deseado) {
    var partes;
    if (!modelo) {
      var t = String(entrada.modeloTexto || "").replace(/\s+/g, " ").trim().slice(0, 120);
      partes = ["Hola, quiero cotizar mi iPhone (modelo no listado: " + (t || "sin especificar") + ")."];
    } else {
      var detalle = String(entrada.detallesTexto || "").replace(/\s+/g, " ").trim().slice(0, 300);
      partes = ["Hola, quiero cotizar mi " + modelo.nombre + " " + Number(entrada.gb) + "GB, " +
        (bateria ? "batería " + bateria + "%" : "batería sin informar") + ", " +
        (entrada.detalles ? "con detalles: " + (detalle || "sin especificar") : "sin detalles") + "."];
    }
    if (deseado) partes.push("Me interesa: " + deseado + ".");
    return partes.join(" ");
  }

  /** Modelos agrupados por generación para los <optgroup>: "iPhone 17", "iPhone 16", … del más nuevo al más viejo. */
  function agruparModelosPorGeneracion(opciones) {
    var grupos = {};
    (opciones.modelos || []).forEach(function (m) {
      var hit = /iPhone\s+(\d+)/i.exec(m.nombre);
      var gen = hit ? Number(hit[1]) : 0;
      (grupos[gen] = grupos[gen] || []).push(m);
    });
    return Object.keys(grupos).map(Number).sort(function (a, b) { return b - a; }).map(function (gen) {
      return { generacion: gen, etiqueta: gen ? "iPhone " + gen : "Otros", modelos: grupos[gen] };
    });
  }

  return {
    NO_LISTADO: NO_LISTADO,
    MENSAJES_SERVIDOR: MENSAJES_SERVIDOR,
    validarFormulario: validarFormulario,
    mensajeWhatsApp: mensajeWhatsApp,
    agruparModelosPorGeneracion: agruparModelosPorGeneracion,
    formatearMonto: formatearMonto,
    buscarModelo: buscarModelo,
    parsearBateria: parsearBateria,
    digitosWhatsapp: digitosWhatsapp
  };
});
