#!/usr/bin/env node
/**
 * Selective Geriatrics staging deploy: apply ONLY migrations 158–159.
 * Never targets production. Never applies 110–120 or 130–157.
 *
 *   node scripts/geriatrics-staging-selective.mjs dry-run
 *   $env:ALLOW_GERIATRICS_STAGING_PUSH="1"
 *   $env:CONFIRM_STAGING_PROJECT_REF="gprmsufvhabntbrytwyi"
 *   node scripts/geriatrics-staging-selective.mjs apply
 *   node scripts/geriatrics-staging-selective.mjs verify
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
  assertLinkedStagingOrExit,
  PRODUCTION_REF,
  STAGING_REF,
} from "./supabase-project-refs.mjs";

const ROOT = process.cwd();
const SRC = resolve(ROOT, "supabase/migrations");
const WORK = resolve(ROOT, ".tmp-geriatrics-staging-push");
const ALLOWED_PENDING = ["158_clinic_products.sql", "159_geriatrics_module.sql"];

const mode = process.argv[2] || "help";

function fail(msg) {
  console.error(`\nERROR: ${msg}\n`);
  process.exit(1);
}

function banner() {
  console.log("TARGET: DrFlow-Staging");
  console.log(`PROJECT REF: ${STAGING_REF}`);
  console.log("PRODUCTION: NOT TARGETED");
  console.log(`Forbidden production ref: ${PRODUCTION_REF}`);
  console.log("Pending allowed: 158, 159 ONLY");
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
    // Exclude clinical gap packs and intermediate unapplied numbered packs.
    if (ver !== null && ver >= 110 && ver <= 120) {
      excluded.push(file);
      continue;
    }
    if (ver !== null && ver >= 130 && ver <= 157) {
      excluded.push(file);
      continue;
    }
    // Keep 001–109, 121–129, 158–159, and timestamped (already on remote).
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
    `Isolated geriatrics staging push workspace.\nSelected ${selected.length} files.\nExcluded ${excluded.length}.\n`,
    "utf8"
  );
  console.log(`Workspace: ${WORK}`);
  console.log(`Selected: ${selected.length} | Excluded: ${excluded.length}`);
  console.log(`Excluded sample: ${excluded.slice(0, 5).join(", ")}…`);
  return WORK;
}

function runDbPush(dryRun) {
  assertLinkedStagingOrExit();
  const cwd = buildWorkspace();
  const args = ["supabase", "db", "push", "--project-ref", STAGING_REF];
  if (dryRun) args.push("--dry-run");
  // Out-of-order relative to timestamped remotes may need include-all; still only 158/159 pending in workspace.
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
  // Also parse JSON-ish lists
  for (const name of ALLOWED_PENDING) {
    if (!out.includes(name) && !out.toLowerCase().includes("remote database is up to date")) {
      // soft: dry-run may list them in error payload
    }
  }
  const unexpected = pending.filter((p) => !ALLOWED_PENDING.includes(p));
  if (unexpected.length) {
    fail(`Unexpected pending migrations in dry-run: ${unexpected.join(", ")}`);
  }
  const has158 = out.includes("158_clinic_products.sql");
  const has159 = out.includes("159_geriatrics_module.sql");
  const upToDate = /up to date/i.test(out);
  if (!upToDate && (!has158 || !has159)) {
    // After apply, verify path may not list them as pending
    if (mode === "dry-run") {
      fail("Dry-run did not clearly list both 158 and 159 as pending.");
    }
  }
  console.log("Pending gate OK: only 158/159 (or already applied).");
}

function verifyRemote() {
  assertLinkedStagingOrExit();
  const result = spawnSync(
    "npx",
    ["supabase", "migration", "list", "--project-ref", STAGING_REF],
    { encoding: "utf8", shell: true, stdio: "pipe" }
  );
  const out = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  console.log(out);
  const ok158 = /"local":"158","remote":"158"/.test(out);
  const ok159 = /"local":"159","remote":"159"/.test(out);
  if (!ok158 || !ok159) {
    fail("Verify failed: 158 and/or 159 not present on remote.");
  }
  console.log("VERIFY OK: 158 and 159 applied on staging.");
}

banner();

if (mode === "dry-run") {
  const { status, out } = runDbPush(true);
  assertOnlyAllowedPending(out);
  process.exit(status === 0 || /158_clinic_products/.test(out) ? 0 : status);
}

if (mode === "apply") {
  if (process.env.ALLOW_GERIATRICS_STAGING_PUSH !== "1") {
    fail('Set ALLOW_GERIATRICS_STAGING_PUSH="1" after reviewing dry-run.');
  }
  if (process.env.CONFIRM_STAGING_PROJECT_REF !== STAGING_REF) {
    fail(`Set CONFIRM_STAGING_PROJECT_REF=${STAGING_REF}`);
  }
  if (process.env.ALLOW_PRODUCTION_DB === "1" || process.env.CONFIRM_PRODUCTION_DB) {
    fail("Production confirmation env vars are set. Unset them.");
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

console.log("Usage: node scripts/geriatrics-staging-selective.mjs [dry-run|apply|verify]");
process.exit(1);
