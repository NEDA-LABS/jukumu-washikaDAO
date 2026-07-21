// Generates raster icon assets from public/logo-mark.svg using sharp.
// Run: node scripts/gen-icons.mjs
import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pub = join(root, 'public');
const app = join(root, 'src', 'app');

const markSvg = readFileSync(join(pub, 'logo-mark.svg'));

// Brand colors
const CREAM = '#F5F1EA';   // warm light background for maskable/apple icons
const INK = '#141210';     // warm near-black

// A flat solid-background square (for apple / maskable icons that need full bleed)
function bgSvg(size, color) {
  const r = Math.round(size * 0.22);
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">` +
    `<rect width="${size}" height="${size}" rx="${r}" fill="${color}"/></svg>`
  );
}

async function renderMark(size) {
  return sharp(markSvg, { density: 384 })
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
}

// Transparent icon (mark only) at a given size
async function transparentIcon(size, outPath) {
  const buf = await renderMark(size);
  writeFileSync(outPath, buf);
}

// Icon on a solid rounded background with padding (apple / maskable)
async function paddedIcon(size, bgColor, padRatio, outPath) {
  const inner = Math.round(size * (1 - padRatio * 2));
  const mark = await renderMark(inner);
  const buf = await sharp(bgSvg(size, bgColor))
    .composite([{ input: mark, gravity: 'center' }])
    .png()
    .toBuffer();
  writeFileSync(outPath, buf);
}

await transparentIcon(16, join(pub, 'favicon-16.png'));
await transparentIcon(32, join(pub, 'favicon-32.png'));
await transparentIcon(48, join(app, 'icon.png'));           // Next app-router favicon fallback
await transparentIcon(192, join(pub, 'icon-192.png'));
await transparentIcon(512, join(pub, 'icon-512.png'));

// Maskable icons need safe-zone padding on an opaque background
await paddedIcon(192, INK, 0.14, join(pub, 'icon-192-maskable.png'));
await paddedIcon(512, INK, 0.14, join(pub, 'icon-512-maskable.png'));

// Apple touch icon — Apple applies its own rounding, so use a full-bleed dark tile
await paddedIcon(180, INK, 0.16, join(app, 'apple-icon.png'));

// A quick preview tile at 256 on cream for visual verification
await paddedIcon(256, CREAM, 0.12, join(pub, '_preview-mark.png'));

console.log('Icons generated.');
