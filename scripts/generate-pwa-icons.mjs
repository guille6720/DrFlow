/**
 * Genera iconos PWA cuadrados (192/512) con fondo sólido para Android/iOS.
 * Azul = app del médico/consultorio · Verde + "Pacientes" = app del paciente.
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

/** #2563eb — consultorio / médico */
const DOCTOR_BRAND = { r: 37, g: 99, b: 235, alpha: 1 };
/** #059669 — pacientes */
const PATIENT_BRAND = { r: 5, g: 150, b: 105, alpha: 1 };

async function buildDoctorIcon(size, logoScale, outputPath, brand) {
  const logoBox = Math.round(size * logoScale);
  const logo = await sharp(logoPath)
    .resize(logoBox, logoBox, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  await sharp({
    create: { width: size, height: size, channels: 4, background: brand },
  })
    .composite([{ input: logo, gravity: "center" }])
    .png({ compressionLevel: 9 })
    .toFile(outputPath);

  const meta = await sharp(outputPath).metadata();
  console.log("OK", outputPath, `${meta.width}x${meta.height}`);
}

function patientLabelSvg(size) {
  const drflowSize = Math.round(size * 0.095);
  const pacientesSize = Math.round(size * 0.072);
  return Buffer.from(`<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <text x="50%" y="${Math.round(size * 0.68)}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="${drflowSize}" fill="#ffffff">DrFlow</text>
  <text x="50%" y="${Math.round(size * 0.82)}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="600" font-size="${pacientesSize}" fill="#d1fae5">Pacientes</text>
</svg>`);
}

async function buildPatientIcon(size, logoScale, outputPath, brand) {
  const logoBox = Math.round(size * logoScale);
  const logoTop = Math.round(size * 0.1);
  const logoLeft = Math.round((size - logoBox) / 2);

  const logo = await sharp(logoPath)
    .resize(logoBox, logoBox, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  await sharp({
    create: { width: size, height: size, channels: 4, background: brand },
  })
    .composite([
      { input: logo, top: logoTop, left: logoLeft },
      { input: patientLabelSvg(size), top: 0, left: 0 },
    ])
    .png({ compressionLevel: 9 })
    .toFile(outputPath);

  const meta = await sharp(outputPath).metadata();
  console.log("OK", outputPath, `${meta.width}x${meta.height}`);
}

async function buildDoctorSet(prefix, brand) {
  await buildDoctorIcon(192, 0.72, join(root, "public", `${prefix}-192.png`), brand);
  await buildDoctorIcon(512, 0.72, join(root, "public", `${prefix}-512.png`), brand);
  await buildDoctorIcon(512, 0.58, join(root, "public", `${prefix}-maskable-512.png`), brand);
}

async function buildPatientSet(prefix, brand) {
  await buildPatientIcon(192, 0.38, join(root, "public", `${prefix}-192.png`), brand);
  await buildPatientIcon(512, 0.38, join(root, "public", `${prefix}-512.png`), brand);
  await buildPatientIcon(512, 0.32, join(root, "public", `${prefix}-maskable-512.png`), brand);
}

await buildDoctorSet("icon", DOCTOR_BRAND);
await buildPatientSet("icon-patient", PATIENT_BRAND);

copyFileSync(join(root, "public", "icon-512.png"), join(root, "src", "app", "icon.png"));

console.log("Iconos PWA listos: azul (médico) + verde Pacientes (paciente).");
