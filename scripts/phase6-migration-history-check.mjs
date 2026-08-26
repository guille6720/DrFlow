#!/usr/bin/env node
/**
 * Phase 6 staging migration history check.
 *
 * Passes when:
 * - portal-related remote versions exist locally
 * - dry-run would not apply any unexpected migrations
 *
 * Known deferred (documented, not Phase 6): 110–120 clinical DX/TX, 140–142 ReNaPDiS
 * (selective staging). Those may appear as local-only pending — that is expected.
 *
 * Never targets production.
 */
import { spawnSync } from "child_process";
import { readdirSync } from "fs";
import { resolve } from "path";

import {
  assertLinkedStagingOrExit,
  PRODUCTION_REF,
  STAGING_REF,
} from "./supabase-project-refs.mjs";

assertLinkedStagingOrExit();

const REQUIRED_REMOTE_VERSIONS = [
  "20260826114420",
  "20260826114605",
  "20260826114630",
  "20260826120601",
  "20260826120735",
  "20260826120822",
  "20260826123241",
  "20260826123459",
  "20260826123700",
  "20260826140000",
  "20260826151000",
];

/** Local numbered migrations intentionally not on staging schema_migrations. */
const KNOWN_DEFERRED_LOCAL = new Set([
  "110_clinical_record_structured_dx_tx.sql",
  "111_clinical_record_dx_tx_normalization.sql",
  "112_clinical_diagnoses_catalog.sql",
  "113_clinical_treatments_catalog.sql",
  "114_clinical_favorites.sql",
  "115_clinical_recent_usage.sql",
  "116_patient_attachments_clinical_record.sql",
  "117_hta_zenith_clinical_treatments.sql",
  "118_data_import_export_sessions.sql",
  "119_historical_document_metadata.sql",
  "120_bulk_clinical_export_job.sql",
  "140_renapdis_phase1_professionals.sql",
  "141_renapdis_phase2_patient_cuir.sql",
  "142_renapdis_phase3_fiscalization_marker.sql",
]);

const migrationsDir = resolve(process.cwd(), "supabase/migrations");
const localFiles = readdirSync(migrationsDir).filter((f) => f.endsWith(".sql"));

console.log(`Phase 6 migration history check — Staging ${STAGING_REF}`);
console.log(`Never production: ${PRODUCTION_REF}`);
console.log("");

const missingLocal = REQUIRED_REMOTE_VERSIONS.filter(
  (v) => !localFiles.some((f) => f.startsWith(`${v}_`))
);
if (missingLocal.length) {
  console.error("FAIL: missing local reconcile files for remote versions:");
  for (const v of missingLocal) console.error(`  - ${v}`);
  process.exit(1);
}
console.log("OK: required remote portal/hardening versions present locally");

const result = spawnSync(
  "npx",
  ["supabase", "db", "push", "--dry-run", "--include-all", "--project-ref", STAGING_REF],
  { encoding: "utf8", shell: true }
);

const out = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
const pending = [
  ...out.matchAll(/supabase\/migrations\/([^\s\\]+?\.sql)/g),
].map((m) => m[1]);

const uniquePending = [...new Set(pending)];
const unexpected = uniquePending.filter((f) => !KNOWN_DEFERRED_LOCAL.has(f));

console.log("");
console.log(`Dry-run pending count: ${uniquePending.length}`);
for (const f of uniquePending) {
  const tag = KNOWN_DEFERRED_LOCAL.has(f) ? "deferred" : "UNEXPECTED";
  console.log(`  [${tag}] ${f}`);
}

if (unexpected.length) {
  console.error("");
  console.error("FAIL: unexpected migrations would be applied on Staging:");
  for (const f of unexpected) console.error(`  - ${f}`);
  console.error("STOP — do not push.");
  process.exit(1);
}

if (uniquePending.some((f) => /patient_portal|202608261/.test(f))) {
  console.error("FAIL: portal timestamp migration still pending (should already be remote).");
  process.exit(1);
}

console.log("");
console.log("PASS: no unexpected Staging migrations pending (portal history reconciled).");
console.log(
  "Note: known deferred 110–120 / 140–142 remain local-only by staging policy."
);
process.exit(0);
