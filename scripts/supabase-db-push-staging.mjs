#!/usr/bin/env node
/**
 * Guarded real db push to DrFlow-Staging ONLY.
 *
 * Never targets production. Requires explicit confirmation env vars.
 * Prefer dry-run first: npm run entitlements:db-push:dry-run
 *
 * Usage (PowerShell):
 *   $env:ALLOW_STAGING_DB_PUSH="1"
 *   $env:CONFIRM_STAGING_DB_PUSH="gprmsufvhabntbrytwyi"
 *   npm run supabase:db-push:staging
 */
import { spawnSync } from "child_process";

import {
  assertLinkedStagingOrExit,
  STAGING_REF,
} from "./supabase-project-refs.mjs";

function fail(message) {
  console.error(`\nERROR: ${message}\n`);
  process.exit(1);
}

assertLinkedStagingOrExit();

if (process.env.ALLOW_STAGING_DB_PUSH !== "1") {
  fail(
    "Refusing real db push. Set ALLOW_STAGING_DB_PUSH=1 after reviewing dry-run output."
  );
}

if (process.env.CONFIRM_STAGING_DB_PUSH !== STAGING_REF) {
  fail(
    `Refusing real db push. Set CONFIRM_STAGING_DB_PUSH=${STAGING_REF} to confirm the staging project ref.`
  );
}

if (process.env.ALLOW_PRODUCTION_DB === "1" || process.env.CONFIRM_PRODUCTION_DB) {
  fail("Production confirmation env vars are set. Unset them for staging pushes.");
}

console.log(`Pushing migrations to staging only: ${STAGING_REF}`);
console.log("Production is never targeted by this script.");
console.log("");

const result = spawnSync(
  "npx",
  ["supabase", "db", "push", "--project-ref", STAGING_REF],
  { encoding: "utf8", shell: true, stdio: "inherit" }
);

process.exit(result.status ?? 1);
