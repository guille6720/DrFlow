/**
 * Apply DrFlow release 0.2.19 production migrations (manual, ordered, idempotent skip).
 *
 * Does NOT replace compliance 130–138 (already on prod). Does NOT touch staging.
 *
 * PowerShell — dry-run (plan only):
 *   cd c:\dev\DrFlow-staging
 *   node scripts/apply-release-0219-production.mjs --dry-run
 *
 * PowerShell — apply all pending release migrations:
 *   $env:ALLOW_PRODUCTION_DB="1"
 *   $env:CONFIRM_PRODUCTION_DB="nipqdarduknydqptqzup"
 *   $env:DATABASE_URL="postgresql://postgres:TU_PASSWORD@db.nipqdarduknydqptqzup.supabase.co:5432/postgres"
 *   node scripts/apply-release-0219-production.mjs
 *
 * Include CIE-10 data import after SQL (112/143/144):
 *   node scripts/apply-release-0219-production.mjs --include-cie10-import
 *
 * Write single SQL file for Supabase SQL Editor (no apply):
 *   node scripts/apply-release-0219-production.mjs --bundle scripts/sql/release-0.2.19-production.sql
 *
 * Apply one block only:
 *   node scripts/apply-release-0219-production.mjs --block renapdis
 *   node scripts/apply-release-0219-production.mjs --block security
 *   node scripts/apply-release-0219-production.mjs --block diagnoses
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { runSqlFile } from "./lib/exec-sql-file.mjs";

import { PRODUCTION_REF } from "./supabase-project-refs.mjs";

const ROOT = process.cwd();
const MIGRATIONS_DIR = resolve(ROOT, "supabase/migrations");

/** @type {{ file: string; version: string; block: string; label: string; optional?: boolean }[]} */
const RELEASE_MIGRATIONS = [
  {
    file: "112_clinical_diagnoses_catalog.sql",
    version: "112",
    block: "diagnoses",
    label: "Clinical diagnoses catalog + search RPC",
    optional: true,
  },
  {
    file: "143_clinical_diagnoses_cie10_import.sql",
    version: "143",
    block: "diagnoses",
    label: "CIE-10 import schema + RPC update",
    optional: true,
  },
  {
    file: "140_renapdis_phase1_professionals.sql",
    version: "140",
    block: "renapdis",
    label: "ReNaPDiS Phase 1 — professionals",
  },
  {
    file: "141_renapdis_phase2_patient_cuir.sql",
    version: "141",
    block: "renapdis",
    label: "ReNaPDiS Phase 2 — patient CUIR",
  },
  {
    file: "142_renapdis_phase3_fiscalization_marker.sql",
    version: "142",
    block: "renapdis",
    label: "ReNaPDiS Phase 3 — fiscalization marker",
  },
  {
    file: "20260826114420_security_definer_execute_hardening.sql",
    version: "20260826114420",
    block: "security",
    label: "EXECUTE hardening — security definer",
  },
  {
    file: "20260826114605_authenticated_rpc_execute_hardening.sql",
    version: "20260826114605",
    block: "security",
    label: "EXECUTE hardening — authenticated RPCs",
  },
  {
    file: "20260826114630_internal_helper_execute_hardening.sql",
    version: "20260826114630",
    block: "security",
    label: "EXECUTE hardening — internal helpers",
  },
  {
    file: "20260826120601_security_definer_anon_allowlist.sql",
    version: "20260826120601",
    block: "security",
    label: "Anon allowlist for public portal/booking",
  },
  {
    file: "20260826120735_public_portal_identity_hardening.sql",
    version: "20260826120735",
    block: "security",
    label: "Public portal identity hardening",
  },
  {
    file: "20260826120822_security_definer_internal_service_only.sql",
    version: "20260826120822",
    block: "security",
    label: "Internal service-only security definer",
  },
  {
    file: "20260826123241_patient_portal_token_sessions.sql",
    version: "20260826123241",
    block: "security",
    label: "Patient portal token sessions (Phase 6)",
  },
  {
    file: "20260826123459_patient_portal_professional_join_fix.sql",
    version: "20260826123459",
    block: "security",
    label: "Portal professional join fix",
  },
  {
    file: "20260826123700_patient_portal_slug_session_validation.sql",
    version: "20260826123700",
    block: "security",
    label: "Portal slug session validation",
  },
  {
    file: "20260826140000_public_booking_preserve_patient_demographics.sql",
    version: "20260826140000",
    block: "security",
    label: "Public booking preserve demographics",
  },
  {
    file: "20260826151000_rls_staff_policies_authenticated_only.sql",
    version: "20260826151000",
    block: "security",
    label: "RLS staff policies authenticated-only",
  },
  {
    file: "144_clinical_diagnoses_rls_select_authenticated.sql",
    version: "144",
    block: "diagnoses",
    label: "Fix clinical_diagnoses SELECT RLS (post-hardening)",
    optional: true,
  },
  {
    file: "145_clinical_diagnoses_search_grants.sql",
    version: "145",
    block: "diagnoses",
    label: "Fix diagnosis search RPC grants + RLS (no is_superadmin in policy)",
    optional: true,
  },
];

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const FORCE = args.includes("--force");
const INCLUDE_CIE10 = args.includes("--include-cie10-import");
const bundleIdx = args.indexOf("--bundle");
const BUNDLE_PATH =
  bundleIdx >= 0 ? resolve(ROOT, args[bundleIdx + 1] ?? "scripts/sql/release-0.2.19-production.sql") : null;
const blockIdx = args.indexOf("--block");
const BLOCK_FILTER = blockIdx >= 0 ? args[blockIdx + 1] : null;

function fail(msg) {
  console.error(`\nERROR: ${msg}\n`);
  process.exit(1);
}

function migrationVersionFromFile(file) {
  const entry = RELEASE_MIGRATIONS.find((m) => m.file === file);
  if (entry) return entry.version;
  const m = file.match(/^(\d{3})_/);
  if (m) return m[1];
  const ts = file.match(/^(20\d{12})_/);
  if (ts) return ts[1];
  return file.replace(/\.sql$/, "");
}

function assertProductionEnv() {
  if (DRY_RUN || BUNDLE_PATH) return process.env.DATABASE_URL?.trim() ?? null;
  if (process.env.ALLOW_PRODUCTION_DB !== "1") {
    fail("Set ALLOW_PRODUCTION_DB=1 explicitly.");
  }
  if (process.env.CONFIRM_PRODUCTION_DB !== PRODUCTION_REF) {
    fail(`Set CONFIRM_PRODUCTION_DB=${PRODUCTION_REF}.`);
  }
  const dbUrl = process.env.DATABASE_URL?.trim();
  if (!dbUrl) fail("Set DATABASE_URL to the production Postgres connection string.");
  if (!dbUrl.includes(PRODUCTION_REF)) {
    fail(`DATABASE_URL must target production ref ${PRODUCTION_REF}.`);
  }
  return dbUrl;
}

function dbQuery(dbUrl, sql) {
  const tmp = resolve(ROOT, `.tmp-release-prod-${Date.now()}.sql`);
  writeFileSync(tmp, sql, "utf8");
  try {
    const result = spawnSync(
      "npx",
      ["supabase", "db", "query", "--db-url", dbUrl, "-f", tmp, "--output-format", "json"],
      { encoding: "utf8", shell: true }
    );
    const text = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
    if (result.status !== 0 || /LegacyDbQueryUnexpectedStatusError|"ERROR:/i.test(text)) {
      throw new Error(text || "db query failed");
    }
    return text;
  } finally {
    try {
      unlinkSync(tmp);
    } catch {
      /* ignore */
    }
  }
}

function parseJsonRows(output) {
  try {
    const json = JSON.parse(output.trim().split("\n").find((l) => l.startsWith("{")) ?? output);
    return json.rows ?? [];
  } catch {
    return [];
  }
}

function fetchAppliedVersions(dbUrl) {
  const out = dbQuery(
    dbUrl,
    `SELECT version FROM supabase_migrations.schema_migrations ORDER BY version;`
  );
  const rows = parseJsonRows(out);
  return new Set(rows.map((r) => String(r.version)));
}

function registerMigration(dbUrl, version) {
  dbQuery(
    dbUrl,
    `INSERT INTO supabase_migrations.schema_migrations (version)
     VALUES ('${version.replace(/'/g, "''")}')
     ON CONFLICT (version) DO NOTHING;`
  );
}

function filterMigrations() {
  let list = [...RELEASE_MIGRATIONS];
  if (BLOCK_FILTER) {
    list = list.filter((m) => m.block === BLOCK_FILTER);
    if (list.length === 0) {
      fail(`Unknown or empty block "${BLOCK_FILTER}". Use: diagnoses | renapdis | security`);
    }
  }
  return list;
}

function buildBundle(migrations, outPath) {
  const parts = [
    "-- DrFlow release 0.2.19 — production migrations bundle",
    `-- Target: ${PRODUCTION_REF}`,
    `-- Generated: ${new Date().toISOString()}`,
    "-- Apply in Supabase SQL Editor IN ORDER. Verify each section before continuing.",
    "-- Preserves existing prod data (additive migrations only).",
    "",
  ];

  for (const mig of migrations) {
    const abs = resolve(MIGRATIONS_DIR, mig.file);
    if (!existsSync(abs)) fail(`Missing ${mig.file}`);
    parts.push(`-- =============================================================================`);
    parts.push(`-- ${mig.version} | ${mig.block} | ${mig.label}`);
    parts.push(`-- File: supabase/migrations/${mig.file}`);
    parts.push(`-- =============================================================================`);
    parts.push(readFileSync(abs, "utf8").trim());
    parts.push("");
    parts.push(
      `INSERT INTO supabase_migrations.schema_migrations (version) VALUES ('${mig.version}') ON CONFLICT DO NOTHING;`
    );
    parts.push("");
  }

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, parts.join("\n"), "utf8");
  console.log(`Wrote bundle (${migrations.length} migrations): ${outPath}`);
}

function printPlan(migrations, applied) {
  console.log(`\nDrFlow release 0.2.19 — production migration plan (${PRODUCTION_REF})\n`);
  for (const mig of migrations) {
    const status = applied?.has(mig.version) ? "SKIP (applied)" : "PENDING";
    const opt = mig.optional ? " [optional if 112 already on prod]" : "";
    console.log(`  [${status}] ${mig.version.padEnd(16)} ${mig.file}${opt}`);
    console.log(`           ${mig.label}`);
  }
  if (INCLUDE_CIE10) {
    console.log("\n  [after SQL] CIE-10 data import via apply-clinical-diagnoses-production.mjs");
  }
  console.log("");
}

const migrations = filterMigrations();

if (args.includes("--list")) {
  for (const mig of migrations) {
    console.log(`${mig.version}\t${mig.block}\t${mig.file}\t${mig.label}`);
  }
  process.exit(0);
}

if (BUNDLE_PATH) {
  buildBundle(migrations, BUNDLE_PATH);
  process.exit(0);
}

const dbUrl = assertProductionEnv();
let applied = null;

if (DRY_RUN && !dbUrl) {
  printPlan(migrations, new Set());
  console.log(JSON.stringify({ mode: "dry-run", target: PRODUCTION_REF, count: migrations.length }, null, 2));
  process.exit(0);
}

if (dbUrl) {
  try {
    applied = fetchAppliedVersions(dbUrl);
  } catch (err) {
    if (DRY_RUN) {
      console.warn("Could not read schema_migrations (dry-run continues):", err.message?.slice(0, 200));
      applied = new Set();
    } else {
      fail(`Could not read schema_migrations: ${err.message}`);
    }
  }
}

printPlan(migrations, applied);

if (DRY_RUN) {
  const pending = migrations.filter((m) => !applied?.has(m.version));
  console.log(JSON.stringify({ mode: "dry-run", target: PRODUCTION_REF, pending: pending.length }, null, 2));
  process.exit(0);
}

const appliedNow = [];
const skipped = [];

(async () => {
for (const mig of migrations) {
  if (!FORCE && applied?.has(mig.version)) {
    console.log(`Skip ${mig.file} (version ${mig.version} already registered)`);
    skipped.push(mig.version);
    continue;
  }

  try {
    await runSqlFile(dbUrl, `supabase/migrations/${mig.file}`);
  } catch (err) {
    fail(err.message ?? String(err));
  }
  registerMigration(dbUrl, mig.version);
  appliedNow.push(mig.version);
}

console.log(
  JSON.stringify(
    {
      target: PRODUCTION_REF,
      applied: appliedNow,
      skipped,
      finished_at: new Date().toISOString(),
    },
    null,
    2
  )
);

if (INCLUDE_CIE10) {
  console.log("\nRunning CIE-10 catalog import (112/143/144 SQL skipped if already applied)...");
  const importScript = resolve(ROOT, "scripts/apply-clinical-diagnoses-production.mjs");
  const result = spawnSync("node", [importScript, "--import-only"], {
    stdio: "inherit",
    shell: true,
    env: process.env,
  });
  if (result.status !== 0) {
    fail("CIE-10 import script failed.");
  }
}

console.log("\nRELEASE_0219_PRODUCTION_MIGRATIONS_OK");
})().catch((err) => fail(err.message ?? String(err)));
