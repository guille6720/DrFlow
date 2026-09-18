#!/usr/bin/env node
/**
 * Apply ONLY geriatrics migrations 158–159 to PRODUCTION via linked Supabase CLI.
 * Does not use db push (avoids history gaps). Does not apply 160+.
 *
 * Defaults: product.clinic ON, product.geriatrics OFF (Superadmin enable only).
 *
 *   node scripts/geriatrics-production-apply-linked.mjs dry-run
 *   $env:ALLOW_GERIATRICS_PRODUCTION_PUSH="1"
 *   $env:ALLOW_PRODUCTION_DB="1"
 *   $env:CONFIRM_PRODUCTION_DB="nipqdarduknydqptqzup"
 *   $env:CONFIRM_PRODUCTION_PROJECT_REF="nipqdarduknydqptqzup"
 *   node scripts/geriatrics-production-apply-linked.mjs apply
 *   node scripts/geriatrics-production-apply-linked.mjs verify
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";

import {
  assertLinkedProductionOrExit,
  PRODUCTION_REF,
  readLinkedProjectRef,
} from "./supabase-project-refs.mjs";

const ROOT = process.cwd();
const mode = process.argv[2] || "help";

const MIGRATIONS = [
  { version: "158", file: "supabase/migrations/158_clinic_products.sql" },
  { version: "159", file: "supabase/migrations/159_geriatrics_module.sql" },
];

function fail(msg) {
  console.error(`\nERROR: ${msg}\n`);
  process.exit(1);
}

function banner() {
  console.log("TARGET: DrFlow PRODUCTION (linked SQL apply)");
  console.log(`PROJECT REF: ${PRODUCTION_REF}`);
  console.log("Applying ONLY: 158_clinic_products, 159_geriatrics_module");
  console.log("Default: geriatrics OFF until Superadmin enables");
  console.log("");
}

function linkedQuery(sql, { asFile = false } = {}) {
  assertLinkedProductionOrExit();
  const linked = readLinkedProjectRef();
  if (linked !== PRODUCTION_REF) {
    fail(`Linked ref is ${linked}; expected ${PRODUCTION_REF}`);
  }

  let tmp = null;
  const args = ["supabase", "db", "query", "--linked"];
  if (asFile) {
    args.push("-f", sql);
  } else {
    tmp = resolve(ROOT, `.tmp-geri-prod-${Date.now()}.sql`);
    writeFileSync(tmp, sql, "utf8");
    args.push("-f", tmp);
  }
  args.push("--output-format", "json");

  try {
    const result = spawnSync("npx", args, {
      cwd: ROOT,
      encoding: "utf8",
      shell: true,
      stdio: "pipe",
    });
    const out = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
    if (result.status !== 0 || /LegacyDbQueryUnexpectedStatusError|"ERROR:/i.test(out)) {
      throw new Error(out.slice(0, 4000) || `exit ${result.status}`);
    }
    return out;
  } finally {
    if (tmp) {
      try {
        unlinkSync(tmp);
      } catch {
        /* ignore */
      }
    }
  }
}

function parseRows(output) {
  try {
    const start = output.indexOf("{");
    const end = output.lastIndexOf("}");
    if (start < 0 || end <= start) return [];
    const json = JSON.parse(output.slice(start, end + 1));
    return json.rows ?? [];
  } catch {
    return [];
  }
}

function fetchApplied() {
  const out = linkedQuery(
    "SELECT version FROM supabase_migrations.schema_migrations WHERE version IN ('158','159') ORDER BY version;"
  );
  return new Set(parseRows(out).map((r) => String(r.version)));
}

function registerVersion(version) {
  linkedQuery(
    `INSERT INTO supabase_migrations.schema_migrations (version) VALUES ('${version}') ON CONFLICT DO NOTHING;`
  );
}

function applyFile(relPath) {
  const abs = resolve(ROOT, relPath);
  if (!existsSync(abs)) fail(`Missing ${relPath}`);
  console.log(`Applying ${relPath} (${readFileSync(abs, "utf8").length} bytes)...`);
  linkedQuery(abs, { asFile: true });
  console.log(`OK ${relPath}`);
}

function verifySchema() {
  const out = linkedQuery(`
SELECT
  to_regclass('public.clinic_products') IS NOT NULL AS clinic_products,
  to_regclass('public.geriatrics_residents') IS NOT NULL AS geriatrics_residents,
  (SELECT count(*)::int FROM public.clinic_products WHERE product_key = 'geriatrics' AND enabled) AS geriatrics_enabled_count,
  (SELECT count(*)::int FROM public.clinic_products WHERE product_key = 'geriatrics') AS geriatrics_rows;
`);
  console.log(out);
  const rows = parseRows(out);
  const row = rows[0] ?? {};
  if (!row.clinic_products || !row.geriatrics_residents) {
    fail("Verify failed: expected tables missing.");
  }
  if (Number(row.geriatrics_enabled_count) > 0) {
    console.warn(
      `WARNING: ${row.geriatrics_enabled_count} clinics already have geriatrics enabled (expected 0 after fresh apply).`
    );
  }
  console.log(
    `VERIFY OK: tables present; geriatrics product rows=${row.geriatrics_rows}; enabled=${row.geriatrics_enabled_count}`
  );
}

banner();

if (mode === "dry-run") {
  const applied = fetchApplied();
  for (const mig of MIGRATIONS) {
    const status = applied.has(mig.version) ? "SKIP (applied)" : "PENDING";
    console.log(`  [${status}] ${mig.version} ${mig.file}`);
  }
  console.log(JSON.stringify({ mode: "dry-run", target: PRODUCTION_REF, pending: MIGRATIONS.filter((m) => !applied.has(m.version)).map((m) => m.version) }, null, 2));
  process.exit(0);
}

if (mode === "apply") {
  if (process.env.ALLOW_GERIATRICS_PRODUCTION_PUSH !== "1") {
    fail('Set ALLOW_GERIATRICS_PRODUCTION_PUSH="1" after reviewing dry-run.');
  }
  if (process.env.ALLOW_PRODUCTION_DB !== "1") {
    fail('Set ALLOW_PRODUCTION_DB="1".');
  }
  if (process.env.CONFIRM_PRODUCTION_DB !== PRODUCTION_REF) {
    fail(`Set CONFIRM_PRODUCTION_DB=${PRODUCTION_REF}`);
  }
  if (process.env.CONFIRM_PRODUCTION_PROJECT_REF !== PRODUCTION_REF) {
    fail(`Set CONFIRM_PRODUCTION_PROJECT_REF=${PRODUCTION_REF}`);
  }

  const applied = fetchApplied();
  for (const mig of MIGRATIONS) {
    if (applied.has(mig.version)) {
      console.log(`Skip ${mig.file} (already registered)`);
      continue;
    }
    applyFile(mig.file);
    registerVersion(mig.version);
    console.log(`Registered schema_migrations version ${mig.version}`);
  }
  verifySchema();
  process.exit(0);
}

if (mode === "verify") {
  const applied = fetchApplied();
  console.log("schema_migrations:", [...applied].join(", ") || "(none)");
  if (!applied.has("158") || !applied.has("159")) {
    fail("158 and/or 159 missing from schema_migrations.");
  }
  verifySchema();
  process.exit(0);
}

console.log("Usage: node scripts/geriatrics-production-apply-linked.mjs [dry-run|apply|verify]");
process.exit(1);
