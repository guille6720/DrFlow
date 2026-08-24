#!/usr/bin/env node
/**
 * Phase 27 — Verify compliance migrations 132–137 on STAGING only.
 * Never targets production. Does not apply migrations (verify-only).
 *
 * Usage:
 *   npm run compliance:migrations:verify-staging
 *
 * Requires either:
 *   - supabase linked to staging + `npx supabase db query --linked -f …`, or
 *   - DATABASE_URL pointing at staging (read-only preferred)
 *
 * If neither is available, exits 0 with SKIP (documented) unless --strict.
 */
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { spawnSync } from "child_process";

import {
  PRODUCTION_REF,
  STAGING_REF,
  assertLinkedStagingOrExit,
  readLinkedProjectRef,
} from "./supabase-project-refs.mjs";

const ROOT = process.cwd();
const VERIFY_SQL = resolve(
  ROOT,
  "supabase/migrations/rollback/VERIFY_132_137_staging.sql"
);
const strict = process.argv.includes("--strict");

function fail(msg) {
  console.error(`\nERROR: ${msg}\n`);
  process.exit(1);
}

console.log("\n🔍 Compliance migrations verify — STAGING ONLY (Fase 27)\n");
console.log(`Forbidden production ref: ${PRODUCTION_REF}`);
console.log(`Expected staging ref:     ${STAGING_REF}\n`);

if (process.env.ALLOW_PRODUCTION_DB === "1" || process.env.CONFIRM_PRODUCTION_DB) {
  fail("Production confirmation env vars are set. Unset them. DO NOT verify/apply on production here.");
}

assertLinkedStagingOrExit();

if (!existsSync(VERIFY_SQL)) {
  fail(`Missing verify SQL: ${VERIFY_SQL}`);
}

const linked = readLinkedProjectRef();
const databaseUrl = process.env.DATABASE_URL?.trim() || process.env.STAGING_DATABASE_URL?.trim();

if (databaseUrl && /nipqdarduknydqptqzup|production/i.test(databaseUrl)) {
  fail("DATABASE_URL looks like production. Refusing.");
}

if (linked === STAGING_REF) {
  console.log("Running verify SQL via supabase db query --linked …\n");
  const result = spawnSync(
    "npx",
    ["supabase", "db", "query", "--linked", "-f", VERIFY_SQL],
    { cwd: ROOT, shell: true, encoding: "utf8" }
  );
  if ((result.status ?? 1) !== 0) {
    console.error(result.stdout || "");
    console.error(result.stderr || "");
    fail("Verify query failed against linked staging.");
  }
  console.log(result.stdout || "");
  console.log("✅ Staging verify query completed (review boolean columns above).\n");
  process.exit(0);
}

if (databaseUrl) {
  console.log("DATABASE_URL/STAGING_DATABASE_URL set but CLI not linked to staging.");
  console.log("Skipping automated psql (no psql dependency assumed).");
  console.log(`Apply manually:\n  psql \"$STAGING_DATABASE_URL\" -f ${VERIFY_SQL}\n`);
  if (strict) fail("Strict mode: linked staging required.");
  process.exit(0);
}

console.log("SKIP: Staging CLI not linked and no STAGING_DATABASE_URL.");
console.log("Link staging, then re-run:");
console.log(`  npx supabase link --project-ref ${STAGING_REF}`);
console.log("  npm run compliance:migrations:verify-staging");
console.log("");
console.log("DO NOT execute production migrations.");
if (strict) fail("Strict mode: staging link required.");
process.exit(0);
