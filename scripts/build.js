#!/usr/bin/env node
/*
 * Minifica CSS y JS con esbuild. Los archivos fuente (css/*.css, js/*.js) NO se tocan: se editan como siempre.
 * Genera, al lado de cada uno, la versión .min (css/style.min.css, js/main.min.js, ...), que son las que cargan los HTML.
 *
 *   npm run build        → regenera todos los .min
 *
 * Cada archivo se minifica por separado (sin agrupar ni cambiar el orden de carga de los <script defer>): los nombres
 * globales que se comparten entre scripts (CATALOGO_DESTACADO, SITE_CONFIG, ...) quedan intactos.
 * Los .min se versionan en el repo porque Vercel publica lo que hay, sin paso de build.
 * Después de cambiar un fuente: npm run build y node scripts/subir-version.js.
 */
const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

const raiz = path.join(__dirname, '..');
const lista = [];
for (const [dir, ext] of [['css', '.css'], ['js', '.js']]) {
  for (const f of fs.readdirSync(path.join(raiz, dir))) {
    if (f.endsWith(ext) && !f.endsWith('.min' + ext)) lista.push([dir, f, ext]);
  }
}
let antes = 0, despues = 0;
for (const [dir, f, ext] of lista) {
  const origen = path.join(raiz, dir, f);
  const destino = path.join(raiz, dir, f.slice(0, -ext.length) + '.min' + ext);
  const src = fs.readFileSync(origen, 'utf8');
  const out = esbuild.transformSync(src, { loader: ext === '.css' ? 'css' : 'js', minify: true, legalComments: 'none', target: 'es2020' }).code;
  fs.writeFileSync(destino, out);
  antes += Buffer.byteLength(src); despues += Buffer.byteLength(out);
  console.log(`${dir}/${f}  ${(Buffer.byteLength(src) / 1024).toFixed(1)} KB → ${(Buffer.byteLength(out) / 1024).toFixed(1)} KB`);
}
console.log(`Total: ${(antes / 1024).toFixed(1)} KB → ${(despues / 1024).toFixed(1)} KB (${lista.length} archivos)`);
