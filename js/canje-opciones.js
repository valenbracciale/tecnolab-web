/**
 * Modelos y capacidades que se pueden cotizar en la calculadora de Plan Canje (solo opciones del formulario).
 * Los valores de toma NO están acá: los calcula el servidor (webhook de n8n, SITE_CONFIG.canjeWebhookUrl).
 * "nombre" se envía tal cual al servidor: tiene que coincidir con el nombre que el servidor conoce.
 */
const CANJE_OPCIONES = {
  modelos: [
    { id: "iphone-13", nombre: "iPhone 13", capacidades: [128, 256] },
    { id: "iphone-13-mini", nombre: "iPhone 13 mini", capacidades: [128, 256] },
    { id: "iphone-13-pro", nombre: "iPhone 13 Pro", capacidades: [128, 256] },
    { id: "iphone-13-pro-max", nombre: "iPhone 13 Pro Max", capacidades: [128, 256] },
    { id: "iphone-14", nombre: "iPhone 14", capacidades: [128, 256] },
    { id: "iphone-14-plus", nombre: "iPhone 14 Plus", capacidades: [128, 256] },
    { id: "iphone-14-pro", nombre: "iPhone 14 Pro", capacidades: [128, 256] },
    { id: "iphone-14-pro-max", nombre: "iPhone 14 Pro Max", capacidades: [128, 256] },
    { id: "iphone-15", nombre: "iPhone 15", capacidades: [128, 256] },
    { id: "iphone-15-plus", nombre: "iPhone 15 Plus", capacidades: [128, 256] },
    { id: "iphone-15-pro", nombre: "iPhone 15 Pro", capacidades: [128, 256] },
    { id: "iphone-15-pro-max", nombre: "iPhone 15 Pro Max", capacidades: [256] },
    { id: "iphone-16e", nombre: "iPhone 16e", capacidades: [128, 256] },
    { id: "iphone-16", nombre: "iPhone 16", capacidades: [128, 256] },
    { id: "iphone-16-pro", nombre: "iPhone 16 Pro", capacidades: [128, 256] },
    { id: "iphone-16-pro-max", nombre: "iPhone 16 Pro Max", capacidades: [256] },
    { id: "iphone-17", nombre: "iPhone 17", capacidades: [256] },
    { id: "iphone-17-pro", nombre: "iPhone 17 Pro", capacidades: [256] },
    { id: "iphone-17-pro-max", nombre: "iPhone 17 Pro Max", capacidades: [256] }
  ]
};
