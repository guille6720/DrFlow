#!/usr/bin/env node
/**
 * Phase 31/safety — supabase db push --dry-run against DrFlow-Staging only.
 *
 * Never applies migrations. Never targets production.
 *
 * Usage: npm run entitlements:db-push:dry-run
 */
import { spawnSync } from "child_process";

import {
  assertLinkedStagingOrExit,
  PRODUCTION_REF,
  STAGING_REF,
} from "./supabase-project-refs.mjs";

assertLinkedStagingOrExit();

console.log(`Target: DrFlow-Staging (${STAGING_REF})`);
console.log("Mode: --dry-run (migrations will NOT be applied)");
console.log(`Never production: ${PRODUCTION_REF}`);
console.log("");

const result = spawnSync(
  "npx",
  ["supabase", "db", "push", "--dry-run", "--project-ref", STAGING_REF],
  { encoding: "utf8", shell: true, stdio: "inherit" }
);

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log(`
Manual review required before any real push
-------------------------------------------
1. npm run supabase:preflight:staging
2. Review dry-run list above
3. Only then (staging):
     $env:ALLOW_STAGING_DB_PUSH="1"
     $env:CONFIRM_STAGING_DB_PUSH="${STAGING_REF}"
     npm run supabase:db-push:staging

Never:
  npx supabase db push --project-ref ${PRODUCTION_REF}
`);
