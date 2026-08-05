/**
 * Aplica solo las migraciones pendientes detectadas por check:supabase.
 * Uso: DATABASE_URL=... npm run migrate:pending
 */
import { spawnSync } from "child_process";
import { resolve } from "path";

const dbUrl = process.env.DATABASE_URL?.trim();
if (!dbUrl) {
  console.error(`
❌ Falta DATABASE_URL

PowerShell:
  $env:DATABASE_URL="postgresql://postgres:TU_PASSWORD@db.nipqdarduknydqptqzup.supabase.co:5432/postgres"
  npm run migrate:pending

O pegá en Supabase SQL Editor (docs/MIGRATIONS.md):
  supabase/migrations/030_clinic_accepted_coverages.sql
  supabase/migrations/031_google_profile_name.sql
  supabase/migrations/032_clinic_trial.sql
`);
  process.exit(1);
}

const pending = [
  "030_clinic_accepted_coverages.sql",
  "031_google_profile_name.sql",
  "032_clinic_trial.sql",
];

console.log(`\n🔧 DrFlow — Reparaciones pendientes (${pending.length} archivos)`);
console.log("   (Migraciones P0 — ver también: npm run migrate:p0)\n");

for (const file of pending) {
  const filePath = resolve(process.cwd(), "supabase/migrations", file);
  console.log(`▶ ${file}`);

  const result = spawnSync(
    "npx",
    ["supabase", "db", "query", "--db-url", dbUrl, "-f", filePath],
    { stdio: "inherit", shell: true }
  );

  if (result.status !== 0) {
    console.error(`\n❌ Error en ${file}. Revisá el mensaje en SQL Editor si hace falta.`);
    process.exit(1);
  }
}

console.log("\n✓ Listo. Verificá: npm run check:supabase\n");
