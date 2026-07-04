/**
 * Aplica solo las migraciones pendientes detectadas por check:supabase.
 * Uso: DATABASE_URL=... npm run migrate:pending
 */
import { resolve } from "path";
import { spawnSync } from "child_process";

const dbUrl = process.env.DATABASE_URL?.trim();
if (!dbUrl) {
  console.error(`
❌ Falta DATABASE_URL

PowerShell:
  $env:DATABASE_URL="postgresql://postgres:TU_PASSWORD@db.nipqdarduknydqptqzup.supabase.co:5432/postgres"
  npm run migrate:pending

O pegá en Supabase SQL Editor:
  supabase/migrations/010_repair_demo_and_rpc.sql
  supabase/migrations/029_appointment_consultation_modality.sql
`);
  process.exit(1);
}

const pending = [
  "010_repair_demo_and_rpc.sql",
  "029_appointment_consultation_modality.sql",
];

console.log(`\n🔧 DrFlow — Reparaciones pendientes (${pending.length} archivos)\n`);

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
