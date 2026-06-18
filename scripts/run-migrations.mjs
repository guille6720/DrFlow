/**
 * Aplica todas las migraciones SQL al proyecto remoto de Supabase.
 *
 * Uso (PowerShell):
 *   $env:DATABASE_URL="postgresql://postgres:TU_PASSWORD@db.nipqdarduknydqptqzup.supabase.co:5432/postgres"
 *   npm run migrate:remote
 *
 * La contraseña es la que elegiste al crear el proyecto (Settings → Database).
 * Si tiene caracteres especiales (@, #, etc.), codificá la URL.
 */
import { readdirSync } from "fs";
import { resolve } from "path";
import { spawnSync } from "child_process";

const dbUrl = process.env.DATABASE_URL?.trim();
if (!dbUrl) {
  console.error(`
❌ Falta DATABASE_URL

Ejemplo (PowerShell):
  $env:DATABASE_URL="postgresql://postgres:TU_PASSWORD@db.nipqdarduknydqptqzup.supabase.co:5432/postgres"
  npm run migrate:remote

La contraseña está en Supabase → Project Settings → Database → Database password
`);
  process.exit(1);
}

const migrationsDir = resolve(process.cwd(), "supabase/migrations");
const files = readdirSync(migrationsDir)
  .filter((name) => name.endsWith(".sql"))
  .sort();

console.log(`\n🗄️  DrFlow — Aplicando ${files.length} migraciones\n`);

for (const file of files) {
  const filePath = resolve(migrationsDir, file);
  console.log(`▶ ${file}`);

  const result = spawnSync(
    "npx",
    ["supabase", "db", "query", "--db-url", dbUrl, "-f", filePath],
    { stdio: "inherit", shell: true }
  );

  if (result.status !== 0) {
    console.error(`\n❌ Error en ${file}. Si el objeto ya existe, revisá el mensaje y seguí manualmente.`);
    process.exit(1);
  }
}

console.log("\n✓ Migraciones aplicadas. Verificá con: npm run check:supabase\n");
