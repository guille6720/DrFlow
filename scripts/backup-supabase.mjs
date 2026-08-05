/**
 * Backup lógico de Postgres (Supabase) vía pg_dump.
 * Requiere pg_dump en PATH y DATABASE_URL en .env.local o entorno.
 *
 * Uso:
 *   node scripts/backup-supabase.mjs
 *   node scripts/backup-supabase.mjs --out=backups/custom.sql
 */
import { spawnSync } from "child_process";
import { existsSync, mkdirSync } from "fs";
import { resolve } from "path";

import { loadEnv, readArg } from "./_env.mjs";

function resolveDatabaseUrl() {
  const env = loadEnv({ required: false });
  return process.env.DATABASE_URL || env.DATABASE_URL || env.SUPABASE_DB_URL;
}

function defaultOutputPath() {
  const dir = resolve(process.cwd(), "backups");
  mkdirSync(dir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  return resolve(dir, `drflow-${ts}.sql`);
}

async function main() {
  const dbUrl = resolveDatabaseUrl();
  if (!dbUrl) {
    console.error(
      "❌ DATABASE_URL no configurada.\n" +
        "   Supabase → Project Settings → Database → Connection string (URI).\n" +
        "   Agregala a .env.local como DATABASE_URL=postgresql://...\n"
    );
    process.exit(1);
  }

  const outArg = readArg("--out");
  const outputPath = outArg ? resolve(process.cwd(), outArg) : defaultOutputPath();
  const outDir = resolve(outputPath, "..");
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

  console.log("\n💾 DrFlow — Backup Postgres\n");
  console.log(`→ ${outputPath}\n`);

  const result = spawnSync(
    "pg_dump",
    ["--no-owner", "--no-acl", "--format=plain", "--file", outputPath, dbUrl],
    { stdio: "inherit", shell: process.platform === "win32" }
  );

  if (result.error?.code === "ENOENT") {
    console.error(
      "\n❌ pg_dump no encontrado. Instalá PostgreSQL client tools o usá Supabase Dashboard → Backups.\n"
    );
    process.exit(1);
  }

  if (result.status !== 0) {
    console.error("\n❌ pg_dump falló\n");
    process.exit(result.status ?? 1);
  }

  console.log("\n✅ Backup creado\n");
}

main().catch((err) => {
  console.error(`\n❌ ${err.message}\n`);
  process.exit(1);
});
