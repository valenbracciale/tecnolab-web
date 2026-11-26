# Calculadora de Plan Canje

El cálculo lo hace un **servidor** (workflow de n8n «Tecnolab - 10 Calculadora Plan Canje», webhook `POST /webhook/canje`).
En el navegador NO hay valores de toma. El workflow valida, calcula el rango y guarda el lead en la tabla `leads_canje`.

| Archivo | Qué tiene |
|---|---|
| `js/canje-opciones.js` | Solo los modelos y capacidades que se ofrecen en el formulario (sin valores en USD) |
| `js/calculadora-data.js` | `datosReales` y `avisoLegal` |
| `js/calculadora-logic.js` | Validaciones puras, mensaje de WhatsApp y formato de montos |
| `js/config.js` | `SITE_CONFIG.canjeWebhookUrl`: URL del webhook |
| `js/main.js` (`initCalculadora`) | El formulario y la comunicación con el servidor |

## Cambiar valores de toma
Se editan **en n8n**, en el nodo «Calcular rango» (constante `TABLA`, y `DESCUENTO_MIN` / `REDONDEO`). No hay que tocar el sitio.

## Sumar o quitar un modelo o una capacidad
1. Agregarlo en el nodo «Calcular rango» de n8n (con sus valores).
2. Agregarlo en `js/canje-opciones.js`. El `nombre` tiene que ser **idéntico** al de la tabla del servidor: es la clave con la que se busca.
3. `node scripts/subir-version.js` y publicar.

## Reglas del servidor que el sitio replica
- WhatsApp: 10 dígitos tras quitar espacios, `+54`, `9` y `0` inicial.
- Con detalles o modelo no listado: el servidor responde `consulta` (sin precio). Batería menor a 75 %: `hasta`.
- Si hay error de red, timeout o respuesta inválida, el sitio NUNCA muestra un precio: ofrece WhatsApp.
- El webhook solo acepta pedidos desde los orígenes configurados en el nodo Webhook (`allowedOrigins`).
