#!/usr/bin/env node
/**
 * Post-E2E assertions against Staging DB (demographics, cancel scope, conflicts).
 * Never prints tokens.
 */
import { spawnSync } from "child_process";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "fs";
import { resolve } from "path";

import {
  assertLinkedStagingOrExit,
  STAGING_REF,
} from "./supabase-project-refs.mjs";

assertLinkedStagingOrExit();

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const i = trimmed.indexOf("=");
    if (i < 0) continue;
    const key = trimmed.slice(0, i);
    const value = trimmed.slice(i + 1);
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile(resolve(process.cwd(), "e2e/.phase6-env.local"));

function dbFile(sql) {
  const tmp = resolve(process.cwd(), `.tmp-phase6-assert-${Date.now()}.sql`);
  writeFileSync(tmp, sql, "utf8");
  try {
    const result = spawnSync(
      "npx",
      [
        "supabase",
        "db",
        "query",
        "--linked",
        "--project-ref",
        STAGING_REF,
        "--file",
        tmp,
        "--output-format",
        "json",
      ],
      { encoding: "utf8", shell: true }
    );
    const text = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
    if (/_tag":"Error"|LegacyDbQueryUnexpectedStatusError/.test(text)) {
      throw new Error(text);
    }
    const jsonStart = text.lastIndexOf('{"boundary"');
    const alt = text.lastIndexOf('{\n  "boundary"');
    const idx = Math.max(jsonStart, alt);
    if (idx < 0) {
      if (result.status === 0 || /Initialising login role/.test(text)) {
        return { rows: [] };
      }
      throw new Error(text || "db query failed");
    }
    let depth = 0;
    let end = -1;
    const startBrace = text.indexOf("{", idx);
    for (let i = startBrace; i < text.length; i++) {
      if (text[i] === "{") depth++;
      if (text[i] === "}") {
        depth--;
        if (depth === 0) {
          end = i + 1;
          break;
        }
      }
    }
    return JSON.parse(text.slice(startBrace, end));
  } finally {
    try {
      unlinkSync(tmp);
    } catch {
      /* ignore */
    }
  }
}

const tokenA = process.env.E2E_PHASE6_TOKEN_VALID;
const apptB = process.env.E2E_PHASE6_APPT_B;
if (!tokenA || !apptB) {
  console.error("Missing E2E_PHASE6_TOKEN_VALID / E2E_PHASE6_APPT_B — run seed first");
  process.exit(1);
}

console.log("Assert demographics preserved for DNI 90060003…");
const demo = dbFile(`
SELECT first_name, last_name, phone, email
FROM public.patients
WHERE clinic_id = 'a0000000-0000-4000-8000-000000000001'
  AND document_number = '90060003'
LIMIT 1;
`);
const d = demo.rows?.[0];
if (!d || d.first_name !== "KeepFirst" || d.last_name !== "KeepLast") {
  console.error("FAIL: demographics overwritten", d);
  process.exit(1);
}
if (d.phone !== "3333333333" || d.email !== "keep@example.test") {
  console.error("FAIL: phone/email overwritten", d);
  process.exit(1);
}
console.log("OK: demographics preserved");

console.log("Assert cancel of other patient's appointment is denied…");
dbFile(`
DO $$
BEGIN
  BEGIN
    PERFORM public.cancel_patient_appointment_v2(
      '${tokenA}',
      '${apptB}'::uuid,
      'E2E should fail'
    );
    RAISE EXCEPTION 'EXPECTED_DENY';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%APPOINTMENT_NOT_FOUND%' OR SQLERRM LIKE '%INVALID_PORTAL_SESSION%' THEN
      NULL;
    ELSIF SQLERRM = 'EXPECTED_DENY' THEN
      RAISE;
    ELSE
      RAISE;
    END IF;
  END;
END $$;
`);
console.log("OK: cross-patient cancel denied");

console.log("Assert invalid professional/clinic rejected…");
dbFile(`
DO $$
DECLARE
  v_detail text;
BEGIN
  BEGIN
    PERFORM public.submit_public_booking(
      'centro-medico-norte-turnos',
      'b0000000-0000-4000-8000-000000000099'::uuid,
      now() + interval '5 days',
      'X', 'Y', '90060999', '1100000000', NULL, 'E2E',
      'patient_data_processing_booking', 'e2e'
    );
    RAISE EXCEPTION 'EXPECTED_REJECT';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_detail = PG_EXCEPTION_DETAIL;
    IF coalesce(v_detail, '') LIKE '%INVALID_PROFESSIONAL%'
       OR SQLERRM LIKE '%INVALID_PROFESSIONAL%'
       OR SQLERRM LIKE '%Profesional no v%' THEN
      NULL;
    ELSIF SQLERRM = 'EXPECTED_REJECT' THEN
      RAISE;
    ELSE
      RAISE;
    END IF;
  END;
END $$;
`);
console.log("OK: invalid professional rejected");

const consent = dbFile(`
SELECT count(*)::int AS n
FROM public.consent_records
WHERE patient_id = (
  SELECT id FROM public.patients
  WHERE clinic_id = 'a0000000-0000-4000-8000-000000000001'
    AND document_number = '90060003'
  LIMIT 1
)
AND consent_type = 'patient_data_processing_booking'
AND created_at > now() - interval '2 days';
`);
console.log(`consent rows (recent): ${consent.rows?.[0]?.n ?? 0}`);

console.log("PASS: Phase 6 DB assertions");
