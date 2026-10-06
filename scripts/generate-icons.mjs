import { mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

// Geometry and colors live in the SVG; no fonts, randomness, or network assets.
const directory = new URL('../public/icons/', import.meta.url);
const source = await readFile(new URL('sigil.svg', directory));
await mkdir(directory, { recursive: true });
for (const size of [192, 512]) {
  await sharp(source).resize(size, size).png({ compressionLevel: 9, adaptiveFiltering: false })
    .toFile(fileURLToPath(new URL(`icon-${size}.png`, directory)));
  // The entire sigil stays inside the central 80% safe circle after scaling.
  const inset = Math.round(size * 0.1);
  const foreground = await sharp(source).resize(size - inset * 2, size - inset * 2).png().toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: '#111711' } })
    .composite([{ input: foreground, left: inset, top: inset }])
    .png({ compressionLevel: 9, adaptiveFiltering: false })
    .toFile(fileURLToPath(new URL(`maskable-${size}.png`, directory)));
}
await sharp(source).resize(180, 180).png({ compressionLevel: 9, adaptiveFiltering: false })
  .toFile(fileURLToPath(new URL('apple-touch-icon.png', directory)));
console.log('Generated 192/512 icons, maskable icons, and Apple 180 icon from sigil.svg.');
