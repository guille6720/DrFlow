/**
 * Genera drflow-logo.png con fondo transparente, bordes suaves y esquinas redondeadas.
 * Uso: node scripts/remove-logo-bg.mjs [ruta-entrada]
 */
import sharp from "sharp";
import { copyFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const defaultInput = join(root, "assets", "logo-drflow-source.png");
const input = process.argv[2] ?? defaultInput;
const output = join(root, "public", "drflow-logo.png");

if (!existsSync(input)) {
  console.error("No se encontró:", input);
  process.exit(1);
}

const { data, info } = await sharp(input)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

const { width, height, channels } = info;

function sample(x, y) {
  const i = (y * width + x) * channels;
  return [data[i], data[i + 1], data[i + 2]];
}

const samples = [
  sample(2, 2),
  sample(width - 3, 2),
  sample(2, height - 3),
  sample(width - 3, height - 3),
];

const bg = samples.reduce(
  (acc, [r, g, b]) => [acc[0] + r, acc[1] + g, acc[2] + b],
  [0, 0, 0]
).map((v) => v / samples.length);

function dist(r, g, b) {
  return Math.sqrt(
    (r - bg[0]) ** 2 + (g - bg[1]) ** 2 + (b - bg[2]) ** 2
  );
}

const TOLERANCE = 42;
const SOFT = 22;

for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const i = (y * width + x) * channels;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const d = dist(r, g, b);

    if (d < TOLERANCE) {
      data[i + 3] = 0;
    } else if (d < TOLERANCE + SOFT) {
      const alpha = Math.round(((d - TOLERANCE) / SOFT) * 255);
      data[i + 3] = Math.min(data[i + 3], alpha);
    }
  }
}

const rgba = await sharp(data, { raw: { width, height, channels: 4 } })
  .png()
  .toBuffer();

const softAlpha = await sharp(rgba)
  .extractChannel("alpha")
  .blur(1.4)
  .toBuffer();

const rgb = await sharp(rgba).removeAlpha().toBuffer();

const softened = await sharp(rgb)
  .joinChannel(softAlpha)
  .png()
  .toBuffer();

const cornerRadius = Math.round(Math.min(width, height) * 0.07);
const roundMask = Buffer.from(
  `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <rect x="0" y="0" width="${width}" height="${height}" rx="${cornerRadius}" ry="${cornerRadius}" fill="white"/>
  </svg>`
);

await sharp(softened)
  .composite([{ input: roundMask, blend: "dest-in" }])
  .png({ compressionLevel: 9 })
  .toFile(output);

copyFileSync(output, join(root, "public", "icon-512.png"));
copyFileSync(output, join(root, "src", "app", "icon.png"));

console.log("OK:", output, "radius=", cornerRadius);
