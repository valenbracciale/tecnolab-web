/**
 * Configuración central del sitio. Cambiar acá antes de publicar:
 *  - whatsappNumber: número real, formato internacional sin "+" ni espacios
 *  - siteUrl: dominio final (también está escrito en canonical/og de cada HTML,
 *    en robots.txt y en sitemap.xml: ver README.md)
 */
const SITE_CONFIG = { whatsappNumber: "5492614699026", siteUrl: "https://www.tecnolabmza.com" };

/**
 * Sucursales: dirección, teléfono y horarios.
 * Fuente de los horarios: ficha pública de Google Maps, 31/10/2026. Actualizar a mano si cambian los horarios.
 *  - horarios: clave = día de la semana (lun, mar, mie, jue, vie, sab, dom); valor = lista de tramos "HH:MM–HH:MM"
 *    (guion largo, 24 h, hora de Mendoza). Lista vacía = cerrado ese día.
 *  - telefono: null = sin confirmar (no se muestra).
 *  - zona: huso horario con el que se calcula "Abierto ahora" (America/Argentina/Mendoza, UTC-3).
 */
const SUCURSALES = {
  dorrego: {
    nombre: "Dorrego",
    direccion: "Moldes 635",
    detalle: null,
    telefono: "0261 469-9026",
    zona: "America/Argentina/Mendoza",
    horarios: {
      lun: ["10:00–14:00", "15:00–19:00"],
      mar: ["10:00–14:00", "15:00–19:00"],
      mie: ["10:00–14:00", "15:00–19:00"],
      jue: ["10:00–14:00", "15:00–19:00"],
      vie: ["10:00–14:00", "15:00–19:00"],
      sab: ["10:00–13:00"],
      dom: []
    }
  },
  lomas: {
    nombre: "Complejo Lomas",
    direccion: "Av. Champagnat",
    detalle: "Lomas Plaza Comercial",
    telefono: null, // sin confirmar: no se muestra
    zona: "America/Argentina/Mendoza",
    horarios: {
      lun: ["09:30–13:00", "17:30–20:30"],
      mar: ["09:30–13:00", "17:30–20:30"],
      mie: ["09:30–13:00", "17:30–20:30"],
      jue: ["09:30–13:00", "17:30–20:30"],
      vie: ["09:30–13:00", "17:30–20:30"],
      sab: ["10:00–12:30"],
      dom: []
    }
  }
};

/**
 * Supabase (productos). La anon/publishable key es pública por diseño: la protección es RLS (solo lectura para anon).
 * La service key NUNCA va acá (ver scripts/seed-supabase.js).
 */
const SUPABASE_URL = "https://kkdnxxwdstpekkehzrde.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_K9ppONpd5a3f676pwbMupA_IsS57NwS";

/**
 * Formato único de precios en todo el sitio y en el panel. Pesos: «$1.850.000». Dólares: «US$ 1.200».
 * useGrouping "always": con 4 dígitos algunos navegadores (es-AR) no ponen el punto.
 */
function formatearPrecio(valor, moneda) {
  const num = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0, useGrouping: "always" }).format(Math.round(Number(valor)));
  return moneda === "USD" ? "US$ " + num : "$" + num;
}
