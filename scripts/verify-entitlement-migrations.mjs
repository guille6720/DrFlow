#!/usr/bin/env node
/**
 * Phase 27 — commercial entitlements staging dry-run verifier.
 *
 * Verifies local migration files 121–128 exist and prints the operator checklist.
 * Does NOT connect to Supabase. Does NOT apply migrations.
 *
 * Usage: node scripts/verify-entitlement-migrations.mjs
 */

import { existsSync, readdirSync } from "fs";
import { resolve } from "path";

const STAGING_REF = "gprmsufvhabntbrytwyi";
const PRODUCTION_REF = "nipqdarduknydqptqzup";

const REQUIRED = [
  "121_commercial_entitlements.sql",
  "122_entitlement_superadmin.sql",
  "123_entitlement_usage_service_role.sql",
  "124_entitlement_usage_status.sql",
  "125_entitlement_current_subscription.sql",
  "126_entitlement_usage_suspend.sql",
  "127_entitlement_trial_window.sql",
  "128_entitlement_trial_expire.sql",
];

const migrationsDir = resolve(process.cwd(), "supabase/migrations");

function fail(message) {
  console.error(`\nERROR: ${message}\n`);
  process.exit(1);
}

if (!existsSync(migrationsDir)) {
  fail(`Missing migrations directory: ${migrationsDir}`);
}

const present = new Set(readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")));
const missing = REQUIRED.filter((f) => !present.has(f));

if (missing.length > 0) {
  fail(`Missing entitlement migrations:\n${missing.map((f) => `  - ${f}`).join("\n")}`);
}

console.log("Commercial entitlements — staging dry-run verifier");
console.log("=================================================");
console.log("This script does NOT apply migrations.");
console.log(`Staging only: ${STAGING_REF}`);
console.log(`Never production: ${PRODUCTION_REF}`);
console.log("");
console.log("Local files OK (121 → 128):");
for (const file of REQUIRED) {
  console.log(`  ✓ ${file}`);
}

console.log(`
Operator checklist (manual — staging only)
------------------------------------------
1. Confirm linked/project ref is ${STAGING_REF} (not ${PRODUCTION_REF}).
2. Run remote dry-run (does not apply):
     npm run entitlements:db-push:dry-run
3. Manually review dry-run output. Do NOT run db push without --dry-run until approved.
4. After review, apply on staging only (never production).
5. Run:  NOTIFY pgrst, 'reload schema';
6. App smoke:
   - /qa/comercial → assign plan basic to a test clinic
   - Caja / portal-apps / API / FHIR / BI show upgrade or redirect
   - Dashboard, pacientes, turnos, HC stay open
7. Suspension: set past_due → extras pause; restore active → extras return
8. Optional: trial window / expire RPCs from 127–128 on a throwaway clinic
9. Fail-open reminder: without 121, catalogAvailable=false and add-ons stay available

Docs: docs/COMMERCIAL_ENTITLEMENTS.md
`);

process.exit(0);
