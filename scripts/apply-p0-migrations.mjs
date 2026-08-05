/**
 * Aplica migraciones P0: 030 (coberturas), 031 (Google name), 032 (trial).
 *
 * Uso (PowerShell):
 *   $env:DATABASE_URL="postgresql://postgres:TU_PASSWORD@db.TU_REF.supabase.co:5432/postgres"
 *   npm run migrate:p0
 */
import { spawnSync } from "child_process";
import { resolve } from "path";

const dbUrl = process.env.DATABASE_URL?.trim();
if (!dbUrl) {
  console.error(`
❌ Falta DATABASE_URL

PowerShell:
  $env:DATABASE_URL="postgresql://postgres:TU_PASSWORD@db.nipqdarduknydqptqzup.supabase.co:5432/postgres"
  npm run migrate:p0

Alternativa: pegar en Supabase SQL Editor (ver docs/MIGRATIONS.md):
  supabase/migrations/030_clinic_accepted_coverages.sql
  supabase/migrations/031_google_profile_name.sql
  supabase/migrations/032_clinic_trial.sql
  supabase/migrations/041_patients_insurance_plan.sql
`);
  process.exit(1);
}

const pending = [
  "030_clinic_accepted_coverages.sql",
  "031_google_profile_name.sql",
  "032_clinic_trial.sql",
  "041_patients_insurance_plan.sql",
];

console.log(`\n🔧 DrFlow — Migraciones P0 (${pending.length} archivos)\n`);

for (const file of pending) {
  const filePath = resolve(process.cwd(), "supabase/migrations", file);
  console.log(`▶ ${file}`);

  const result = spawnSync(
    "npx",
    ["supabase", "db", "query", "--db-url", dbUrl, "-f", filePath],
    { stdio: "inherit", shell: true }
  );

  if (result.status !== 0) {
    console.error(`\n❌ Error en ${file}. Revisá el mensaje o aplicá el SQL manualmente.`);
    process.exit(1);
  }
}

console.log("\n✓ P0 aplicado. Verificá: npm run check:supabase\n");
