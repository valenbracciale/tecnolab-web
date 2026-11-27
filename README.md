# Tecnolab — sitio web

Sitio estático (HTML/CSS/JS vanilla) desplegado en Vercel. **Sin build en el deploy**: lo que está en el repo es lo que se publica. Los archivos fuente (`css/style.css`, `js/*.js`) se editan a mano; los `.min` que cargan los HTML se generan con `npm run build` y también se versionan.

## Estructura

```
index.html  catalogo.html  service.html  plan-canje.html  nosotros.html  404.html
css/style.css            Todo el CSS (variables de marca al principio). style.min.css = versión minificada (npm run build).
js/main.js               Toda la interacción (menú, catálogo, carrusel, calculadora, opiniones, horarios…).
js/hero-glass.js         Lente de cristal del logo del hero (WebGL). Solo se descarga con mouse fino (ver index.html).
js/glass-button.js       Vidrio líquido del botón «Ver catálogo» del hero (solo index.html; filtro propio #lg-refract-btn).
js/config.js             WhatsApp, URL del sitio y SUCURSALES (dirección, teléfono, horarios).
js/products-data.js      Catálogo destacado (iPhone, AirPods, Mac).
js/accesorios-data.js    Accesorios (se suman a la grilla de catalogo.html).
js/reviews-data.js       Reseñas de Google Maps y promedios.
js/calculadora-*.js, canje-opciones.js  Calculadora de Plan Canje: formulario y opciones; el cálculo es del servidor (ver scripts/cargar-datos.md).
assets/img/              Solo imágenes en uso (WebP). assets/img/clientes/: fotos de clientes.
scripts/                 Herramientas de desarrollo y pruebas (se versiona, no se publica).
_originales/             Fotos originales y material pendiente. SOLO en el disco: no se versiona ni se publica.
vercel.json  robots.txt  sitemap.xml
```

## Antes de publicar

1. **WhatsApp**: `whatsappNumber` en `js/config.js` (formato internacional, sin `+`). Los `href` de respaldo de los HTML llevan el mismo número.
2. **Dominio**: `siteUrl` en `js/config.js` y el mismo dominio en `canonical` / `og:url` de cada HTML, en `sitemap.xml` y en `robots.txt`.
3. Si cambió algún CSS o JS: **`npm run build`** (regenera los `.min`) y **subir `?v=`** (ver abajo).
4. Correr las pruebas (ver abajo).

## Fondo de las secciones oscuras (`.bg-post`)

Todas las secciones oscuras usan el degradé circular azul acero de `css/style.css` (tokens `--post-*` en `:root`): clase base `bg-post` +
una variante que pone la luz clara en un borde: `bg-post--a` (izquierda), `--b` (arriba a la derecha) y `--c` (abajo al centro: su luz llega a
blanco y se funde con el footer, que es blanco sólido y no lleva degradé). La asignación es fija:

| Sección | Variante |
| --- | --- |
| hero de index · hero de nosotros · hero de plan-canje · hero de 404 | a |
| `#why-tecnolab` · hero de catalogo · hero de service | b |
| franja final (`.final-cta`) de todas las páginas | c |
| footer de todas las páginas | sin degradé: fondo blanco, `data-header-theme="light"` |

Dos secciones con degradé nunca van seguidas (y una luz clara nunca toca el borde de otra sección con degradé). Para una sección oscura nueva: `class="... bg-post bg-post--x"` (elegir una variante distinta
de las vecinas). Sobre este fondo el texto es blanco (secundarios al 88 %, apagados al 78 %) y los acentos `#CDEBFF`; si se mueve o agranda la luz,
volver a medir el contraste (mínimo 4,5:1 en texto normal, 3:1 en texto grande).

## Tareas frecuentes

**Agregar un producto** — en `js/products-data.js`, un objeto nuevo en `CATALOGO_DESTACADO`
(`id`, `categoria`, `nombre`, `variante`, `especificacion`, `precio`, `precioNum`, `colores: [{ nombre, hex, imagen }]`, `disponible`).
La card, el detalle y el menú del catálogo se generan solos. Foto: ponerla en `assets/img/` (WebP, fondo transparente) y
referenciarla en `colores[].imagen`. Sin fotos, dejar `colores: []` y la card muestra «Foto próximamente».

**Agregar un accesorio** — una fila `["Subcategoría", "Nombre", precio]` en `ACCESORIOS_BASE` de `js/accesorios-data.js`.
Los precios no se muestran hasta que `ACCESORIOS_CONFIG.mostrarPrecio` sea `true`.

**Actualizar reseñas** — `js/reviews-data.js`: `promedio` y `cantidad` de cada sucursal, y la lista `resenas`.
Los textos se copian **tal cual** (sin corregir ni resumir); no se muestran estrellas por reseña. Cambiar `RESENAS_ACTUALIZADO`
(es la leyenda «Datos de Google Maps, mes año»). Las fotos de clientes son los nombres de `CLIENTES_FOTOS` al inicio de `js/main.js`
(archivos en `assets/img/clientes/`).

**Actualizar horarios o teléfono** — `SUCURSALES` en `js/config.js`: `horarios` por día (`lun`…`dom`) con tramos `"HH:MM–HH:MM"`
(lista vacía = cerrado) y `telefono` (`null` = no se muestra). El «Abierto ahora» se calcula con la hora de Mendoza.
Los horarios vienen de Google Maps: actualizar a mano si cambian.

**Logo oscuro del footer** — `assets/img/logo-vertical-oscuro.webp` es `_originales/logo-vertical-blanco.png` recoloreado a `#0B0720` (mismo alpha, 400×199). Si cambia el logo, regenerarlo con `sharp` (ver `scripts/optimize-images.js`).

**Imágenes** — `assets/*` se sirve con `Cache-Control: immutable` por un año (`vercel.json`): si se reemplaza una imagen,
**cambiarle el nombre** (y la referencia). Para convertir fotos nuevas: `cd scripts && npm install && node optimize-images.js`.

## Minificado: `npm run build`

Los HTML cargan `css/style.min.css` y `js/*.min.js`. Se generan desde los fuente con esbuild (los fuente no cambian):

```bash
npm install        # una sola vez (esbuild)
npm run build      # regenera css/*.min.css y js/*.min.js (scripts/build.js)
```

- **Editá siempre el fuente** (`css/style.css`, `js/main.js`, …), nunca el `.min`. Si no corrés `npm run build`, el sitio sigue sirviendo el `.min` viejo.
- Cada archivo se minifica por separado, sin agruparlos: se conserva el orden de los `<script defer>` y los nombres globales entre scripts.
- `js/products-data.js` y demás archivos de datos también tienen su `.min`: si los regenerás (scripts/cargar-datos.md), corré el build.

## Cache de CSS y JS: `?v=` (obligatorio)

`/css/*` y `/js/*` se sirven con `Cache-Control: public, max-age=31536000, immutable` (vercel.json): el navegador no vuelve a preguntar por un año.
**Regla: si cambia un CSS o JS, subir el `?v=` en todos los HTML.** Sin eso, los visitantes recurrentes siguen viendo la versión vieja. El HTML se sirve siempre con revalidación, así que el `?v=` nuevo les llega enseguida.
Todos los `<link>` y `<script>` de los HTML llevan `?v=N` (también el loader de `hero-glass.min.js` en `index.html`):

```bash
npm run build                        # primero los .min
node scripts/subir-version.js        # suma 1 en todos los HTML
node scripts/subir-version.js --ver  # muestra el valor actual y avisa si hay valores distintos
```

Las imágenes de `assets/` ya tienen caché de un año: si cambia una foto, se le cambia el nombre. Las tipografías (`assets/fonts/`, Montserrat 300 y 600, latin y latin-ext) se alojan en el sitio: no hay pedidos a Google Fonts.

## Pruebas y chequeos

```bash
bash scripts/check-placeholders.sh   # número de WhatsApp, dominio y «Foto próximamente» pendientes
```

Salen con código 1 si algo falla (`check-placeholders.sh` solo avisa por las fotos pendientes).

## scripts/ y _originales/

- `scripts/`: `check-placeholders.sh`, `subir-version.js`, `optimize-images.js` y
  `cutout-products.js` (usan `sharp`: `cd scripts && npm install`), `cargar-datos.md` (cómo funciona y se actualiza la calculadora de Plan Canje).
  Se versiona (salvo `scripts/node_modules/`) y está en `.vercelignore`.
- `_originales/`: fotos originales, el render del hero y las fotos del catálogo pendiente (`_originales/pendientes/`).
  Está en `.gitignore` y en `.vercelignore`: queda en la computadora de quien la usa, no en el repositorio.
