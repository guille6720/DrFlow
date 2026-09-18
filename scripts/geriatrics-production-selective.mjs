#!/usr/bin/env node
/**
 * Selective Geriatrics PRODUCTION deploy: apply ONLY migrations 158–159.
 * Never applies 110–120 or 130–157. Never targets staging from this script.
 *
 * Defaults after apply:
 *   - product.clinic = ON (backfill)
 *   - product.geriatrics = OFF for all clinics
 * Superadmin enables Geriatría per clinic from /superadmin/clinics/[id].
 *
 *   node scripts/geriatrics-production-selective.mjs dry-run
 *   $env:ALLOW_GERIATRICS_PRODUCTION_PUSH="1"
 *   $env:ALLOW_PRODUCTION_DB="1"
 *   $env:CONFIRM_PRODUCTION_DB="nipqdarduknydqptqzup"
 *   $env:CONFIRM_PRODUCTION_PROJECT_REF="nipqdarduknydqptqzup"
 *   node scripts/geriatrics-production-selective.mjs apply
 *   node scripts/geriatrics-production-selective.mjs verify
 */
import { spawnSync } from "child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "fs";
import { join, resolve } from "path";

import {
  assertLinkedProductionOrExit,
  PRODUCTION_REF,
  STAGING_REF,
} from "./supabase-project-refs.mjs";

const ROOT = process.cwd();
const SRC = resolve(ROOT, "supabase/migrations");
const WORK = resolve(ROOT, ".tmp-geriatrics-production-push");
const ALLOWED_PENDING = ["158_clinic_products.sql", "159_geriatrics_module.sql"];

const mode = process.argv[2] || "help";

function fail(msg) {
  console.error(`\nERROR: ${msg}\n`);
  process.exit(1);
}

function banner() {
  console.log("TARGET: DrFlow PRODUCTION");
  console.log(`PROJECT REF: ${PRODUCTION_REF}`);
  console.log(`Forbidden staging ref: ${STAGING_REF}`);
  console.log("Pending allowed: 158, 159 ONLY");
  console.log("Default after apply: geriatrics OFF (Superadmin toggle only)");
  console.log("");
}

function migrationVersion(filename) {
  const m = filename.match(/^(\d+)/);
  return m ? Number(m[1]) : null;
}

function selectWorkspaceMigrations() {
  const all = readdirSync(SRC).filter((f) => f.endsWith(".sql"));
  const selected = [];
  const excluded = [];
  for (const file of all.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))) {
    const ver = migrationVersion(file);
    if (ver !== null && ver >= 110 && ver <= 120) {
      excluded.push(file);
      continue;
    }
    if (ver !== null && ver >= 130 && ver <= 157) {
      excluded.push(file);
      continue;
    }
    // Defer post-geriatrics packs (e.g. 160 research protocols) to a separate apply.
    if (ver !== null && ver >= 160) {
      excluded.push(file);
      continue;
    }
    selected.push(file);
  }
  return { selected, excluded };
}

function buildWorkspace() {
  const { selected, excluded } = selectWorkspaceMigrations();
  for (const name of ALLOWED_PENDING) {
    if (!selected.includes(name)) fail(`Missing required migration: ${name}`);
  }
  if (selected.some((f) => f.startsWith("110_") || f.startsWith("130_"))) {
    fail("Forbidden migration leaked into workspace");
  }

  rmSync(WORK, { recursive: true, force: true });
  mkdirSync(join(WORK, "supabase", "migrations"), { recursive: true });
  cpSync(resolve(ROOT, "supabase/config.toml"), join(WORK, "supabase/config.toml"));
  if (existsSync(resolve(ROOT, "supabase/.temp"))) {
    cpSync(resolve(ROOT, "supabase/.temp"), join(WORK, "supabase/.temp"), { recursive: true });
  }
  for (const file of selected) {
    cpSync(join(SRC, file), join(WORK, "supabase/migrations", file));
  }
  writeFileSync(
    join(WORK, "README.txt"),
    `Isolated geriatrics PRODUCTION push workspace.\nSelected ${selected.length} files.\nExcluded ${excluded.length}.\n`,
    "utf8"
  );
  console.log(`Workspace: ${WORK}`);
  console.log(`Selected: ${selected.length} | Excluded: ${excluded.length}`);
  return WORK;
}

function runDbPush(dryRun) {
  assertLinkedProductionOrExit();
  const cwd = buildWorkspace();
  const args = ["supabase", "db", "push", "--project-ref", PRODUCTION_REF];
  if (dryRun) args.push("--dry-run");
  args.push("--include-all");
  console.log(`\nRunning: npx ${args.join(" ")}\n`);
  const result = spawnSync("npx", args, {
    cwd,
    encoding: "utf8",
    shell: true,
    stdio: "pipe",
  });
  const out = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  console.log(out);
  return { status: result.status ?? 1, out };
}

function assertOnlyAllowedPending(out) {
  const pending = [];
  for (const line of out.split(/\r?\n/)) {
    const m = line.match(/supabase\/migrations\/(\d+_[\w.-]+\.sql)/);
    if (m) pending.push(m[1]);
  }
  const unexpected = pending.filter((p) => !ALLOWED_PENDING.includes(p));
  if (unexpected.length) {
    fail(`Unexpected pending migrations in dry-run: ${unexpected.join(", ")}`);
  }
  console.log("Pending gate OK: only 158/159 (or already applied).");
}

function verifyRemote() {
  assertLinkedProductionOrExit();
  const result = spawnSync(
    "npx",
    ["supabase", "migration", "list", "--project-ref", PRODUCTION_REF],
    { encoding: "utf8", shell: true, stdio: "pipe" }
  );
  const out = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  console.log(out);
  const ok158 = /"local":"158","remote":"158"/.test(out) || /\b158\b.*\b158\b/.test(out);
  const ok159 = /"local":"159","remote":"159"/.test(out) || /\b159\b.*\b159\b/.test(out);
  if (!ok158 || !ok159) {
    fail("Verify failed: 158 and/or 159 not present on production remote.");
  }
  console.log("VERIFY OK: 158 and 159 applied on PRODUCTION.");
}

banner();

if (mode === "dry-run") {
  const { status, out } = runDbPush(true);
  assertOnlyAllowedPending(out);
  process.exit(status === 0 || /158_clinic_products/.test(out) ? 0 : status);
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
  if (process.env.ALLOW_STAGING_DB_PUSH === "1" || process.env.CONFIRM_STAGING_PROJECT_REF) {
    fail("Staging confirmation env vars are set. Unset them before production apply.");
  }
  const dry = runDbPush(true);
  assertOnlyAllowedPending(dry.out);
  const { status, out } = runDbPush(false);
  console.log(out);
  if (status !== 0) process.exit(status);
  verifyRemote();
  process.exit(0);
}

if (mode === "verify") {
  verifyRemote();
  process.exit(0);
}

console.log("Usage: node scripts/geriatrics-production-selective.mjs [dry-run|apply|verify]");
process.exit(1);
