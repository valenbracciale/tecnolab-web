// Configuración de la calculadora de Plan Canje. Los valores de toma NO están en el navegador: los calcula
// el servidor (webhook de n8n, SITE_CONFIG.canjeWebhookUrl en js/config.js). Los modelos y capacidades
// disponibles están en js/canje-opciones.js.
//
// Con `datosReales` en false la calculadora NO se muestra al público
// (solo con ?preview=1 en la URL de plan-canje.html, con una franja de aviso).
const CANJE_CONFIG = {
  datosReales: true,               // la calculadora es pública
  moneda: "USD",
  avisoLegal: "Valor estimado, sujeto a verificación final en el local, en persona. No constituye presupuesto oficial: puede haber detalles no informados."
};
