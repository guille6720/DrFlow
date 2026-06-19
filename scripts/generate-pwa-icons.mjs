/**
 * Genera iconos PWA cuadrados (192/512) con fondo sólido para Android/iOS.
 * Uso: node scripts/generate-pwa-icons.mjs [logo-transparente.png]
 */
import sharp from "sharp";
import { copyFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const defaultLogo = join(root, "public", "drflow-logo.png");
const logoPath = process.argv[2] ?? defaultLogo;

if (!existsSync(logoPath)) {
  console.error("No se encontró logo:", logoPath);
  process.exit(1);
}

const BRAND = { r: 37, g: 99, b: 235, alpha: 1 }; // #2563eb

async function buildSquareIcon(size, logoScale, outputPath) {
  const logoBox = Math.round(size * logoScale);

  const logo = await sharp(logoPath)
    .resize(logoBox, logoBox, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: BRAND,
    },
  })
    .composite([{ input: logo, gravity: "center" }])
    .png({ compressionLevel: 9 })
    .toFile(outputPath);

  const meta = await sharp(outputPath).metadata();
  console.log("OK", outputPath, `${meta.width}x${meta.height}`);
}

await buildSquareIcon(192, 0.72, join(root, "public", "icon-192.png"));
await buildSquareIcon(512, 0.72, join(root, "public", "icon-512.png"));
await buildSquareIcon(512, 0.58, join(root, "public", "icon-maskable-512.png"));

copyFileSync(join(root, "public", "icon-512.png"), join(root, "src", "app", "icon.png"));

console.log("Iconos PWA listos para manifest y pantalla de inicio.");
