/**
 * Valida variables obligatorias para producción (pre-deploy / CI ops).
 * Uso:
 *   node scripts/validate-env.mjs
 *   node scripts/validate-env.mjs --production
 */
import { loadEnv } from "./_env.mjs";

const productionRequired = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_SITE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "CRON_SECRET",
];

const productionWarnings = ["DATABASE_URL"];

function isProductionMode() {
  return process.argv.includes("--production") || process.env.NODE_ENV === "production";
}

function main() {
  loadEnv({ required: false });
  const isProd = isProductionMode();

  if (!isProd) {
    console.log("\n✓ validate-env (modo dev — sin comprobaciones estrictas)\n");
    process.exit(0);
  }

  const missing = productionRequired.filter((key) => !process.env[key]?.trim());
  const warnings = productionWarnings.filter((key) => !process.env[key]?.trim());

  console.log("\n🔐 DrFlow — Validación entorno producción\n");

  if (missing.length) {
    console.error(`❌ Faltan: ${missing.join(", ")}`);
    console.error("   Ver .env.example y PRODUCTION_READINESS_REPORT.md\n");
    process.exit(1);
  }

  if (process.env.CRON_SECRET.trim().length < 16) {
    console.error("❌ CRON_SECRET debe tener al menos 16 caracteres\n");
    process.exit(1);
  }

  for (const key of warnings) {
    console.log(`⚠ ${key} no configurada — backups/migraciones manuales limitados`);
  }

  const hasEmail =
    process.env.RESEND_API_KEY?.trim() ||
    (process.env.SMTP_HOST?.trim() && process.env.EMAIL_FROM?.trim());
  if (!hasEmail) {
    console.log(
      "⚠ Email de invitaciones no configurado — configurá RESEND_API_KEY o SMTP_HOST + EMAIL_FROM en Vercel"
    );
  }

  console.log("\n✅ Variables de producción OK\n");
}

main();
