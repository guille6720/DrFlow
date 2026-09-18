#!/usr/bin/env node
/**
 * Phase 5 — logical backup procedure (schema + data + roles metadata).
 * Requires DATABASE_URL in environment — never commits backup files.
 *
 * Usage:
 *   DATABASE_URL=postgresql://... node scripts/disaster-recovery/logical-backup.mjs
 *   node scripts/disaster-recovery/logical-backup.mjs --check-only
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { loadEnv } from "../_env.mjs";
import { STAGING_REF } from "../supabase-project-refs.mjs";

const OUT_DIR = resolve(process.cwd(), "backups");
const REPORT = resolve(process.cwd(), "coverage/phase5-logical-backup-status.json");
const checkOnly = process.argv.includes("--check-only");

function resolveDatabaseUrl() {
  const env = loadEnv({ required: false });
  return process.env.DATABASE_URL || env.DATABASE_URL || env.SUPABASE_DB_URL || null;
}

function timestampSlug() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function runPgDump(args, outputPath) {
  const dbUrl = resolveDatabaseUrl();
  const result = spawnSync("pg_dump", [...args, "--file", outputPath, dbUrl], {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  return result.status === 0;
}

const dbUrl = resolveDatabaseUrl();
const report = {
  generatedAt: new Date().toISOString(),
  stagingRef: STAGING_REF,
  databaseUrlConfigured: Boolean(dbUrl),
  setupRequired: !dbUrl,
  setupInstructions: [
    "Supabase Dashboard → DrFlow-Staging → Database → Connection string (URI, direct or pooler)",
    "Set DATABASE_URL in .env.local or shell (never commit)",
    "Install PostgreSQL client tools (pg_dump, pg_restore) on operator workstation",
    "Run: npm run phase5:dr:logical-backup",
    "Store encrypted backup off-repo (e.g. org vault, encrypted object storage)",
    "Restore test: pg_restore --no-owner --no-acl -d <new_db_url> backups/drflow-<ts>.dump",
  ],
  encryptionStorageProcedure:
    "Encrypt at rest (AES-256 or cloud KMS); restrict ACL to DBA/on-call; rotate retention per policy",
  restoreTestProcedure:
    "Restore to isolated Supabase project or local Postgres; run validate-recovery-integrity against new URL",
  artifacts: [],
  pass: false,
};

if (!dbUrl) {
  mkdirSync(resolve(process.cwd(), "coverage"), { recursive: true });
  writeFileSync(REPORT, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log("\n💾 Phase 5 — Logical backup\n");
  console.log("   ⛔ DATABASE_URL not configured — setup REQUIRED\n");
  for (const step of report.setupInstructions) console.log(`   • ${step}`);
  console.log(`\n→ ${REPORT}\n`);
  process.exit(checkOnly ? 0 : 2);
}

if (checkOnly) {
  report.pass = true;
  mkdirSync(resolve(process.cwd(), "coverage"), { recursive: true });
  writeFileSync(REPORT, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log("\n✅ DATABASE_URL configured — ready for logical backup\n");
  process.exit(0);
}

mkdirSync(OUT_DIR, { recursive: true });
const ts = timestampSlug();
const schemaPath = resolve(OUT_DIR, `drflow-${ts}-schema.sql`);
const dataPath = resolve(OUT_DIR, `drflow-${ts}-data.sql`);
const rolesPath = resolve(OUT_DIR, `drflow-${ts}-roles.sql`);

console.log("\n💾 Phase 5 — Logical backup (staging)\n");

const schemaOk = runPgDump(["--schema-only", "--no-owner", "--no-acl"], schemaPath);
const dataOk = runPgDump(["--data-only", "--no-owner", "--no-acl"], dataPath);
const rolesOk = runPgDump(["--roles-only"], rolesPath);

for (const [kind, path, ok] of [
  ["schema", schemaPath, schemaOk],
  ["data", dataPath, dataOk],
  ["roles", rolesPath, rolesOk],
]) {
  if (ok && existsSync(path)) {
    report.artifacts.push({
      kind,
      path: path.replace(process.cwd(), "."),
      sizeBytes: statSync(path).size,
      createdAt: new Date().toISOString(),
    });
  }
}

report.pass = report.artifacts.length === 3;
report.note = "Backup files contain staging data — do NOT commit to git (.gitignore backups/)";

mkdirSync(resolve(process.cwd(), "coverage"), { recursive: true });
writeFileSync(REPORT, `${JSON.stringify(report, null, 2)}\n`, "utf8");

console.log(`\n→ ${REPORT}`);
process.exit(report.pass ? 0 : 1);
