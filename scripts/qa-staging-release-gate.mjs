#!/usr/bin/env node
/**
 * Final release QA gate — STAGING ONLY.
 * - Verifies/applies migration 154
 * - Runs read-only clinical integrity counts (IDs only, no PHI)
 * - Probes PATIENT_MISMATCH via dry DO block (rollback)
 *
 * Usage:
 *   node scripts/qa-staging-release-gate.mjs
 *   node scripts/qa-staging-release-gate.mjs --apply-154
 *
 * Never targets production.
 */
import { spawnSync } from "node:child_process";
import { existsSync, unlinkSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  assertLinkedStagingOrExit,
  PRODUCTION_REF,
  readLinkedProjectRef,
  STAGING_REF,
} from "./supabase-project-refs.mjs";

const ROOT = process.cwd();
const APPLY_154 = process.argv.includes("--apply-154");
const MIGRATION_154 = resolve(ROOT, "supabase/migrations/154_clinical_record_patient_identity_lock.sql");

function fail(msg) {
  console.error(`\nFAIL: ${msg}\n`);
  process.exit(1);
}

function runLinkedSql(sql, label) {
  const tmp = resolve(ROOT, `.tmp-qa-gate-${Date.now()}-${Math.random().toString(36).slice(2)}.sql`);
  writeFileSync(tmp, sql, "utf8");
  try {
    const result = spawnSync(
      "npx",
      ["supabase", "db", "query", "--linked", "--project-ref", STAGING_REF, "-f", tmp],
      { cwd: ROOT, shell: true, encoding: "utf8" }
    );
    const text = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
    if ((result.status ?? 1) !== 0 || /LegacyDbQueryExecError|"ERROR:/i.test(text)) {
      throw new Error(`${label}: ${text.slice(0, 2500)}`);
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

console.log("\n=== DrFlow staging release QA gate ===");
console.log(`Expected staging: ${STAGING_REF}`);
console.log(`Forbidden production: ${PRODUCTION_REF}`);

if (process.env.ALLOW_PRODUCTION_DB === "1" || process.env.CONFIRM_PRODUCTION_DB) {
  fail("Production confirmation env vars are set. Aborting.");
}

assertLinkedStagingOrExit();
const linked = readLinkedProjectRef();
if (linked !== STAGING_REF) {
  fail(`Linked ref is "${linked}", expected ${STAGING_REF}`);
}

const dbUrl = process.env.DATABASE_URL?.trim() || process.env.STAGING_DATABASE_URL?.trim();
if (dbUrl && /nipqdarduknydqptqzup/i.test(dbUrl)) {
  fail("DATABASE_URL looks like production. Aborting.");
}

// --- 1) Migration 154 presence ---
console.log("\n[1] Checking update_clinical_record_atomic for PATIENT_MISMATCH…");
const defOut = runLinkedSql(
  `SELECT
     CASE
       WHEN pg_get_functiondef('public.update_clinical_record_atomic(uuid,uuid,uuid,uuid,uuid,text,text,text,text,uuid,timestamptz,text,text,text,text,jsonb,jsonb,text)'::regprocedure)
            ILIKE '%PATIENT_MISMATCH%'
       THEN true ELSE false
     END AS has_patient_mismatch;`,
  "check-154-def"
);
const hasMismatch = /t(rue)?/i.test(defOut) && /has_patient_mismatch/i.test(defOut)
  ? /has_patient_mismatch[^\n]*\n[^\n]*t/i.test(defOut) || /\|\s*t\s*\|/i.test(defOut) || /true/i.test(defOut)
  : /true/i.test(defOut);

let migrationApplied = hasMismatch;
  if (!hasMismatch) {
  console.log("Migration 154 NOT detected in function body.");
  if (!APPLY_154) {
    fail("154 not applied. Re-run with --apply-154 to apply on staging only.");
  }
  if (!existsSync(MIGRATION_154)) fail(`Missing ${MIGRATION_154}`);
  console.log("Applying migration 154 to staging…");
  const applyResult = spawnSync(
    "npx",
    ["supabase", "db", "query", "--linked", "--project-ref", STAGING_REF, "-f", MIGRATION_154],
    { cwd: ROOT, shell: true, encoding: "utf8" }
  );
  const applyText = `${applyResult.stdout ?? ""}\n${applyResult.stderr ?? ""}`;
  if ((applyResult.status ?? 1) !== 0 || /LegacyDbQueryExecError|"ERROR:/i.test(applyText)) {
    fail(`Applying 154 failed: ${applyText.slice(0, 2500)}`);
  }
  console.log("Migration 154 apply command completed.");
  const verifyOut = runLinkedSql(
    `SELECT
       CASE
         WHEN pg_get_functiondef('public.update_clinical_record_atomic(uuid,uuid,uuid,uuid,uuid,text,text,text,text,uuid,timestamptz,text,text,text,text,jsonb,jsonb,text)'::regprocedure)
              ILIKE '%PATIENT_MISMATCH%'
         THEN true ELSE false
       END AS has_patient_mismatch;`,
    "verify-154-def"
  );
  if (!/true/i.test(verifyOut) && !/\|\s*t\s*\|/i.test(verifyOut)) {
    fail(`154 applied but PATIENT_MISMATCH still missing. Output:\n${verifyOut.slice(0, 1000)}`);
  }
  migrationApplied = true;
  console.log("PASS: PATIENT_MISMATCH present after apply.");
} else {
  console.log("PASS: PATIENT_MISMATCH already present.");
}

// --- 2) Integrity audit (counts + IDs only) ---
console.log("\n[2] Read-only clinical integrity audit…");
const integritySql = `
WITH checks AS (
  SELECT 'clinical_record_diagnoses_patient_mismatch'::text AS check_name,
         COUNT(*)::bigint AS violation_count,
         COALESCE(array_agg(d.id ORDER BY d.id) FILTER (WHERE d.patient_id IS DISTINCT FROM r.patient_id OR d.clinic_id IS DISTINCT FROM r.clinic_id), '{}') AS record_ids
  FROM clinical_record_diagnoses d
  JOIN clinical_records r ON r.id = d.clinical_record_id
  WHERE d.patient_id IS DISTINCT FROM r.patient_id OR d.clinic_id IS DISTINCT FROM r.clinic_id

  UNION ALL
  SELECT 'clinical_record_treatments_patient_mismatch',
         COUNT(*)::bigint,
         COALESCE(array_agg(t.id ORDER BY t.id) FILTER (WHERE t.patient_id IS DISTINCT FROM r.patient_id OR t.clinic_id IS DISTINCT FROM r.clinic_id), '{}')
  FROM clinical_record_treatments t
  JOIN clinical_records r ON r.id = t.clinical_record_id
  WHERE t.patient_id IS DISTINCT FROM r.patient_id OR t.clinic_id IS DISTINCT FROM r.clinic_id

  UNION ALL
  SELECT 'prescription_drafts_patient_mismatch',
         COUNT(*)::bigint,
         COALESCE(array_agg(pd.id ORDER BY pd.id) FILTER (
           WHERE pd.clinical_record_id IS NOT NULL
             AND (pd.patient_id IS DISTINCT FROM r.patient_id OR pd.clinic_id IS DISTINCT FROM r.clinic_id)
         ), '{}')
  FROM prescription_drafts pd
  LEFT JOIN clinical_records r ON r.id = pd.clinical_record_id
  WHERE pd.clinical_record_id IS NOT NULL
    AND (pd.patient_id IS DISTINCT FROM r.patient_id OR pd.clinic_id IS DISTINCT FROM r.clinic_id)

  UNION ALL
  SELECT 'medical_orders_patient_mismatch',
         COUNT(*)::bigint,
         COALESCE(array_agg(mo.id ORDER BY mo.id) FILTER (
           WHERE mo.clinical_record_id IS NOT NULL
             AND (mo.patient_id IS DISTINCT FROM r.patient_id OR mo.clinic_id IS DISTINCT FROM r.clinic_id)
         ), '{}')
  FROM medical_orders mo
  LEFT JOIN clinical_records r ON r.id = mo.clinical_record_id
  WHERE mo.clinical_record_id IS NOT NULL
    AND (mo.patient_id IS DISTINCT FROM r.patient_id OR mo.clinic_id IS DISTINCT FROM r.clinic_id)

  UNION ALL
  SELECT 'patient_attachments_patient_mismatch',
         COUNT(*)::bigint,
         COALESCE(array_agg(pa.id ORDER BY pa.id) FILTER (
           WHERE pa.clinical_record_id IS NOT NULL
             AND (pa.patient_id IS DISTINCT FROM r.patient_id OR pa.clinic_id IS DISTINCT FROM r.clinic_id)
         ), '{}')
  FROM patient_attachments pa
  LEFT JOIN clinical_records r ON r.id = pa.clinical_record_id
  WHERE pa.clinical_record_id IS NOT NULL
    AND (pa.patient_id IS DISTINCT FROM r.patient_id OR pa.clinic_id IS DISTINCT FROM r.clinic_id)

  UNION ALL
  SELECT 'patient_problem_list_source_mismatch',
         COUNT(*)::bigint,
         COALESCE(array_agg(ppl.id ORDER BY ppl.id) FILTER (
           WHERE ppl.source_clinical_record_id IS NOT NULL
             AND (ppl.patient_id IS DISTINCT FROM r.patient_id OR ppl.clinic_id IS DISTINCT FROM r.clinic_id)
         ), '{}')
  FROM patient_problem_list ppl
  LEFT JOIN clinical_records r ON r.id = ppl.source_clinical_record_id
  WHERE ppl.source_clinical_record_id IS NOT NULL
    AND (ppl.patient_id IS DISTINCT FROM r.patient_id OR ppl.clinic_id IS DISTINCT FROM r.clinic_id)

  UNION ALL
  SELECT 'clinical_records_clinic_vs_patient',
         COUNT(*)::bigint,
         COALESCE(array_agg(cr.id ORDER BY cr.id) FILTER (WHERE cr.clinic_id IS DISTINCT FROM p.clinic_id), '{}')
  FROM clinical_records cr
  JOIN patients p ON p.id = cr.patient_id
  WHERE cr.clinic_id IS DISTINCT FROM p.clinic_id

  UNION ALL
  SELECT 'clinical_records_null_patient',
         COUNT(*)::bigint,
         COALESCE(array_agg(cr.id ORDER BY cr.id) FILTER (WHERE cr.patient_id IS NULL), '{}')
  FROM clinical_records cr
  WHERE cr.patient_id IS NULL

  UNION ALL
  SELECT 'appointments_clinical_record_patient_mismatch',
         COUNT(*)::bigint,
         COALESCE(array_agg(cr.id ORDER BY cr.id) FILTER (
           WHERE cr.appointment_id IS NOT NULL
             AND (a.patient_id IS DISTINCT FROM cr.patient_id OR a.clinic_id IS DISTINCT FROM cr.clinic_id)
         ), '{}')
  FROM clinical_records cr
  JOIN appointments a ON a.id = cr.appointment_id
  WHERE cr.appointment_id IS NOT NULL
    AND (a.patient_id IS DISTINCT FROM cr.patient_id OR a.clinic_id IS DISTINCT FROM cr.clinic_id)

  UNION ALL
  SELECT 'clinical_record_audit_patient_mismatch',
         COUNT(*)::bigint,
         COALESCE(array_agg(a.id ORDER BY a.id) FILTER (
           WHERE a.patient_id IS DISTINCT FROM r.patient_id OR a.clinic_id IS DISTINCT FROM r.clinic_id
         ), '{}')
  FROM clinical_record_audit a
  JOIN clinical_records r ON r.id = a.clinical_record_id
  WHERE a.patient_id IS DISTINCT FROM r.patient_id OR a.clinic_id IS DISTINCT FROM r.clinic_id

  UNION ALL
  SELECT 'orphan_diagnoses_clinical_record',
         COUNT(*)::bigint,
         COALESCE(array_agg(d.id ORDER BY d.id), '{}')
  FROM clinical_record_diagnoses d
  LEFT JOIN clinical_records r ON r.id = d.clinical_record_id
  WHERE r.id IS NULL

  UNION ALL
  SELECT 'orphan_treatments_clinical_record',
         COUNT(*)::bigint,
         COALESCE(array_agg(t.id ORDER BY t.id), '{}')
  FROM clinical_record_treatments t
  LEFT JOIN clinical_records r ON r.id = t.clinical_record_id
  WHERE r.id IS NULL
)
SELECT check_name, violation_count,
       CASE WHEN violation_count > 0 THEN record_ids[1:20]::text ELSE '[]' END AS sample_record_ids
FROM checks
ORDER BY check_name;
`;

const integrityOut = runLinkedSql(integritySql, "integrity-audit");
console.log(integrityOut);

const badCounts = [...integrityOut.matchAll(/\|\s*(\d+)\s*\|/g)]
  .map((m) => Number(m[1]))
  .filter((n) => Number.isFinite(n) && n > 0);
// Also catch JSON-ish outputs
const jsonCountHits = [...integrityOut.matchAll(/"violation_count"\s*:\s*"?(\d+)"?/g)].map((m) =>
  Number(m[1])
);
const _anyViolations =
  badCounts.some((n) => n > 0) ||
  jsonCountHits.some((n) => n > 0) ||
  /violation_count[^\n]*[1-9]/i.test(integrityOut);

// Heuristic: if every check printed 0 we're good; parse more carefully via a compact count query
const countOnlyOut = runLinkedSql(
  `
SELECT SUM(c.violation_count)::bigint AS total_violations FROM (
  SELECT COUNT(*)::bigint AS violation_count FROM clinical_record_diagnoses d JOIN clinical_records r ON r.id = d.clinical_record_id WHERE d.patient_id IS DISTINCT FROM r.patient_id OR d.clinic_id IS DISTINCT FROM r.clinic_id
  UNION ALL SELECT COUNT(*) FROM clinical_record_treatments t JOIN clinical_records r ON r.id = t.clinical_record_id WHERE t.patient_id IS DISTINCT FROM r.patient_id OR t.clinic_id IS DISTINCT FROM r.clinic_id
  UNION ALL SELECT COUNT(*) FROM prescription_drafts pd JOIN clinical_records r ON r.id = pd.clinical_record_id WHERE pd.clinical_record_id IS NOT NULL AND (pd.patient_id IS DISTINCT FROM r.patient_id OR pd.clinic_id IS DISTINCT FROM r.clinic_id)
  UNION ALL SELECT COUNT(*) FROM medical_orders mo JOIN clinical_records r ON r.id = mo.clinical_record_id WHERE mo.clinical_record_id IS NOT NULL AND (mo.patient_id IS DISTINCT FROM r.patient_id OR mo.clinic_id IS DISTINCT FROM r.clinic_id)
  UNION ALL SELECT COUNT(*) FROM patient_attachments pa JOIN clinical_records r ON r.id = pa.clinical_record_id WHERE pa.clinical_record_id IS NOT NULL AND (pa.patient_id IS DISTINCT FROM r.patient_id OR pa.clinic_id IS DISTINCT FROM r.clinic_id)
  UNION ALL SELECT COUNT(*) FROM patient_problem_list ppl JOIN clinical_records r ON r.id = ppl.source_clinical_record_id WHERE ppl.source_clinical_record_id IS NOT NULL AND (ppl.patient_id IS DISTINCT FROM r.patient_id OR ppl.clinic_id IS DISTINCT FROM r.clinic_id)
  UNION ALL SELECT COUNT(*) FROM clinical_records cr JOIN patients p ON p.id = cr.patient_id WHERE cr.clinic_id IS DISTINCT FROM p.clinic_id
  UNION ALL SELECT COUNT(*) FROM clinical_records cr WHERE cr.patient_id IS NULL
  UNION ALL SELECT COUNT(*) FROM clinical_records cr JOIN appointments a ON a.id = cr.appointment_id WHERE cr.appointment_id IS NOT NULL AND (a.patient_id IS DISTINCT FROM cr.patient_id OR a.clinic_id IS DISTINCT FROM cr.clinic_id)
  UNION ALL SELECT COUNT(*) FROM clinical_record_audit a JOIN clinical_records r ON r.id = a.clinical_record_id WHERE a.patient_id IS DISTINCT FROM r.patient_id OR a.clinic_id IS DISTINCT FROM r.clinic_id
  UNION ALL SELECT COUNT(*) FROM clinical_record_diagnoses d LEFT JOIN clinical_records r ON r.id = d.clinical_record_id WHERE r.id IS NULL
  UNION ALL SELECT COUNT(*) FROM clinical_record_treatments t LEFT JOIN clinical_records r ON r.id = t.clinical_record_id WHERE r.id IS NULL
) c;
`,
  "integrity-total"
);
console.log(countOnlyOut);

const totalMatch = countOnlyOut.match(/total_violations[^\d]*(\d+)/i) || countOnlyOut.match(/\|\s*(\d+)\s*\|/);
const totalViolations = totalMatch ? Number(totalMatch[1]) : null;
if (totalViolations == null) {
  fail(`Could not parse integrity total. Output:\n${countOnlyOut.slice(0, 800)}`);
}
if (totalViolations > 0) {
  fail(`Integrity violations found: total_violations=${totalViolations}. STOP — do not auto-repair.`);
}
console.log("PASS: integrity total_violations=0");

// --- 3) PATIENT_MISMATCH behavioral probe (transaction rolled back) ---
console.log("\n[3] Probing PATIENT_MISMATCH (rollback-only)…");
const probeOut = runLinkedSql(
  `
DO $$
DECLARE
  v_clinic uuid;
  v_record uuid;
  v_patient uuid;
  v_other uuid;
  v_professional uuid;
  v_user uuid;
  v_raised boolean := false;
BEGIN
  SELECT cr.clinic_id, cr.id, cr.patient_id, cr.professional_id
    INTO v_clinic, v_record, v_patient, v_professional
  FROM clinical_records cr
  WHERE cr.patient_id IS NOT NULL
  LIMIT 1;

  IF v_record IS NULL THEN
    RAISE NOTICE 'PROBE_SKIPPED_NO_RECORDS';
    RETURN;
  END IF;

  SELECT p.id INTO v_other
  FROM patients p
  WHERE p.clinic_id = v_clinic AND p.id IS DISTINCT FROM v_patient
  LIMIT 1;

  IF v_other IS NULL THEN
    RAISE NOTICE 'PROBE_SKIPPED_NO_SECOND_PATIENT';
    RETURN;
  END IF;

  SELECT id INTO v_user FROM profiles LIMIT 1;

  BEGIN
    PERFORM public.update_clinical_record_atomic(
      v_clinic, v_record, v_other, v_professional, NULL,
      'qa', 'qa', 'qa', 'qa', COALESCE(v_user, v_professional),
      NULL, 'QA PATIENT_MISMATCH probe', NULL, NULL, NULL, NULL, NULL, NULL
    );
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM ILIKE '%PATIENT_MISMATCH%' THEN
        v_raised := true;
      ELSIF SQLERRM ILIKE '%FORBIDDEN%' THEN
        RAISE NOTICE 'PROBE_SKIPPED_FORBIDDEN';
        RETURN;
      ELSE
        RAISE EXCEPTION 'UNEXPECTED_ERROR: %', SQLERRM;
      END IF;
  END;

  IF NOT v_raised THEN
    RAISE EXCEPTION 'PATIENT_MISMATCH_NOT_RAISED';
  END IF;

  RAISE NOTICE 'PROBE_OK record=% expected_patient=% attempted=%', v_record, v_patient, v_other;
  RAISE EXCEPTION 'QA_ROLLBACK';
EXCEPTION
  WHEN OTHERS THEN
    IF SQLERRM = 'QA_ROLLBACK' OR SQLERRM ILIKE '%QA_ROLLBACK%' THEN
      RAISE NOTICE 'PROBE_ROLLED_BACK';
    ELSIF SQLERRM ILIKE '%PROBE_SKIPPED%' THEN
      RAISE NOTICE '%', SQLERRM;
    ELSIF SQLERRM ILIKE '%PROBE_OK%' THEN
      RAISE NOTICE '%', SQLERRM;
    ELSE
      RAISE;
    END IF;
END $$;
`,
  "patient-mismatch-probe"
);
console.log(probeOut);

if (/PATIENT_MISMATCH_NOT_RAISED|UNEXPECTED_ERROR/i.test(probeOut) && !/FORBIDDEN|SKIPPED/i.test(probeOut)) {
  fail("PATIENT_MISMATCH probe failed.");
}
if (/PROBE_SKIPPED/i.test(probeOut)) {
  console.log("WARN: mismatch probe skipped (insufficient staging seed data). Treat write-ownership as UNVERIFIED.");
} else if (/PROBE_ROLLED_BACK|PROBE_OK/i.test(probeOut) || /NOTICE/i.test(probeOut)) {
  console.log("PASS: PATIENT_MISMATCH probe completed without persisting changes.");
} else {
  // supabase may swallow notices — if no error, treat cautiously
  console.log("WARN: probe finished without clear NOTICE; inspect output above.");
}

console.log("\n=== QA GATE SUMMARY ===");
console.log(`migration_154_applied=${migrationApplied}`);
console.log(`integrity_total_violations=${totalViolations}`);
console.log("DONE\n");
process.exit(0);
