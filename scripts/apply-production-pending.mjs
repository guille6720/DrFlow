/**
 * Aplica migraciones pendientes de producción (030 → 041).
 *
 * PowerShell:
 *   cd c:\dev\DrFlow
 *   $env:DATABASE_URL="postgresql://postgres:TU_PASSWORD@db.nipqdarduknydqptqzup.supabase.co:5432/postgres"
 *   npm run migrate:production-pending
 */
import { resolve } from "path";
import { spawnSync } from "child_process";

const dbUrl = process.env.DATABASE_URL?.trim();
if (!dbUrl) {
  console.error(`
❌ Falta DATABASE_URL

PowerShell:
  $env:DATABASE_URL="postgresql://postgres:TU_PASSWORD@db.nipqdarduknydqptqzup.supabase.co:5432/postgres"
  npm run migrate:production-pending

Alternativa manual: Supabase → SQL Editor → ver docs/SUPABASE_PENDIENTE.md
`);
  process.exit(1);
}

const pending = [
  "030_clinic_accepted_coverages.sql",
  "031_google_profile_name.sql",
  "032_clinic_trial.sql",
  "033_legal_compliance.sql",
  "034_secretaria_caja.sql",
  "035_remove_clinic_user.sql",
  "036_auth_user_delete_trigger.sql",
  "037_fix_cleanup_optional_tables.sql",
  "038_fix_cleanup_keep_professionals.sql",
  "039_delete_own_account.sql",
  "040_delete_own_account_purge_clinic.sql",
  "041_patients_insurance_plan.sql",
];

console.log(`\n🔧 DrFlow — Migraciones producción (${pending.length} archivos, 030→041)\n`);

for (const file of pending) {
  const filePath = resolve(process.cwd(), "supabase/migrations", file);
  console.log(`▶ ${file}`);

  const result = spawnSync(
    "npx",
    ["supabase", "db", "query", "--db-url", dbUrl, "-f", filePath],
    { stdio: "inherit", shell: true }
  );

  if (result.status !== 0) {
    console.error(`
❌ Error en ${file}

Si el error dice "type already exists" en 034, es porque parte de 034 ya corrió.
Aplicá el resto manualmente desde docs/SUPABASE_PENDIENTE.md
`);
    process.exit(1);
  }
}

console.log("\n✓ Migraciones 030–041 aplicadas.");
console.log("  Verificá: npm run check:supabase");
console.log("  Extra:    node scripts/check-insurance-plan-column.mjs\n");
