#!/usr/bin/env node
/* Genera icon-192/512, favicon-48, favicon.ico (16/32/48) y apple-touch-icon (180) desde el isotipo.
 * Cuadrados, isotipo centrado con 15% de margen por lado, fondo sólido #0B0720, sin esquinas redondeadas.
 *   node scripts/generar-iconos.js */
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const raiz = path.join(__dirname, '..');
const BG = { r: 11, g: 7, b: 32, alpha: 1 };
const src = path.join(raiz, 'assets/img/logo-tecnolab-isotipo.png');

async function icono(size) {
  const inner = Math.round(size * 0.7);
  const iso = await sharp(src).resize(inner, inner, { fit: 'inside' }).toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background: BG } })
    .composite([{ input: iso, gravity: 'center' }]).png().toBuffer();
}

(async () => {
  const w = (n, b) => fs.writeFileSync(path.join(raiz, n), b);
  w('icon-192.png', await icono(192));
  w('icon-512.png', await icono(512));
  w('favicon-48.png', await icono(48));
  w('apple-touch-icon.png', await icono(180));
  const tams = [16, 32, 48];
  const pngs = await Promise.all(tams.map(icono));
  const head = Buffer.alloc(6); head.writeUInt16LE(1, 2); head.writeUInt16LE(tams.length, 4);
  let off = 6 + 16 * tams.length;
  const dir = pngs.map((p, i) => {
    const e = Buffer.alloc(16);
    e[0] = tams[i]; e[1] = tams[i]; e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6);
    e.writeUInt32LE(p.length, 8); e.writeUInt32LE(off, 12); off += p.length; return e;
  });
  w('favicon.ico', Buffer.concat([head, ...dir, ...pngs]));

  // Verificación de medidas
  for (const [n, s] of [['icon-192.png', 192], ['icon-512.png', 512], ['favicon-48.png', 48], ['apple-touch-icon.png', 180]]) {
    const m = await sharp(path.join(raiz, n)).metadata();
    const px = await sharp(path.join(raiz, n)).raw().toBuffer();
    const ok = m.width === s && m.height === s && px[0] === 11 && px[1] === 7 && px[2] === 32;
    console.log(n, m.width + 'x' + m.height, 'esquina #0B0720:', ok ? 'OK' : 'FALLA');
  }
  const ico = fs.readFileSync(path.join(raiz, 'favicon.ico'));
  const n = ico.readUInt16LE(4);
  const sizes = [];
  for (let i = 0; i < n; i++) sizes.push(ico[6 + i * 16] + 'x' + ico[7 + i * 16]);
  console.log('favicon.ico', sizes.join(','));
})();
