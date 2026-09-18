#!/usr/bin/env node
/**
 * Seeds Phase 6 synthetic staging data and writes e2e/.phase6-env.local (gitignored).
 * Never prints raw portal tokens.
 */
import { spawnSync } from "child_process";
import { createHash, randomBytes } from "crypto";
import { unlinkSync, writeFileSync } from "fs";
import { resolve } from "path";

import {
  assertLinkedStagingOrExit,
  STAGING_REF,
} from "./supabase-project-refs.mjs";

assertLinkedStagingOrExit();

function dbFile(sql) {
  const tmp = resolve(process.cwd(), `.tmp-phase6-${Date.now()}-${Math.random().toString(16).slice(2)}.sql`);
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
      // DO blocks may return empty rows array without boundary in some versions
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

function token() {
  return randomBytes(32).toString("hex");
}

function hashHex(t) {
  return createHash("sha256").update(t, "utf8").digest("hex");
}

const seedSql = `
DO $$
DECLARE
  v_clinic_a uuid := 'a0000000-0000-4000-8000-000000000001';
  v_prof uuid := 'b0000000-0000-4000-8000-000000000001';
  v_patient_a uuid;
  v_patient_b uuid;
  v_patient_existing uuid;
  v_start timestamptz := date_trunc('day', now() + interval '4 days') + interval '15 hours';
BEGIN
  SELECT id INTO v_patient_a FROM public.patients
  WHERE clinic_id = v_clinic_a AND document_number = '90060001' LIMIT 1;
  IF v_patient_a IS NULL THEN
    INSERT INTO public.patients (clinic_id, first_name, last_name, document_number, phone, email)
    VALUES (v_clinic_a, 'E2EPhase6', 'PortalA', '90060001', '1111111111', 'e2e-phase6-a@example.test')
    RETURNING id INTO v_patient_a;
  ELSE
    UPDATE public.patients SET first_name='E2EPhase6', last_name='PortalA', phone='1111111111', email='e2e-phase6-a@example.test'
    WHERE id = v_patient_a;
  END IF;

  SELECT id INTO v_patient_b FROM public.patients
  WHERE clinic_id = v_clinic_a AND document_number = '90060002' LIMIT 1;
  IF v_patient_b IS NULL THEN
    INSERT INTO public.patients (clinic_id, first_name, last_name, document_number, phone, email)
    VALUES (v_clinic_a, 'E2EPhase6', 'PortalB', '90060002', '2222222222', 'e2e-phase6-b@example.test')
    RETURNING id INTO v_patient_b;
  END IF;

  SELECT id INTO v_patient_existing FROM public.patients
  WHERE clinic_id = v_clinic_a AND document_number = '90060003' LIMIT 1;
  IF v_patient_existing IS NULL THEN
    INSERT INTO public.patients (clinic_id, first_name, last_name, document_number, phone, email)
    VALUES (v_clinic_a, 'KeepFirst', 'KeepLast', '90060003', '3333333333', 'keep@example.test')
    RETURNING id INTO v_patient_existing;
  ELSE
    UPDATE public.patients SET first_name='KeepFirst', last_name='KeepLast', phone='3333333333', email='keep@example.test'
    WHERE id = v_patient_existing;
  END IF;

  DELETE FROM public.appointments
  WHERE clinic_id = v_clinic_a
    AND patient_id IN (v_patient_a, v_patient_b)
    AND booking_source = 'online'
    AND notes LIKE 'E2E Phase6%';

  INSERT INTO public.appointments (
    clinic_id, patient_id, professional_id, start_at, end_at, status, notes, booking_source
  ) VALUES (
    v_clinic_a, v_patient_a, v_prof, v_start, v_start + interval '30 minutes',
    'pending', 'E2E Phase6 own appointment', 'online'
  );

  INSERT INTO public.appointments (
    clinic_id, patient_id, professional_id, start_at, end_at, status, notes, booking_source
  ) VALUES (
    v_clinic_a, v_patient_b, v_prof, v_start + interval '1 hour', v_start + interval '90 minutes',
    'confirmed', 'E2E Phase6 other patient appointment', 'online'
  );
END $$;
`;

console.log("Seeding Phase 6 synthetic patients/appointments on Staging…");
dbFile(seedSql);

const ids = dbFile(`
SELECT
  (SELECT id::text FROM public.patients WHERE clinic_id = 'a0000000-0000-4000-8000-000000000001' AND document_number = '90060001' LIMIT 1) AS patient_a,
  (SELECT id::text FROM public.patients WHERE clinic_id = 'a0000000-0000-4000-8000-000000000001' AND document_number = '90060002' LIMIT 1) AS patient_b,
  (SELECT id::text FROM public.patients WHERE clinic_id = 'a0000000-0000-4000-8000-000000000001' AND document_number = '90060003' LIMIT 1) AS patient_existing,
  (SELECT id::text FROM public.appointments WHERE notes = 'E2E Phase6 own appointment' ORDER BY created_at DESC LIMIT 1) AS appt_a,
  (SELECT id::text FROM public.appointments WHERE notes = 'E2E Phase6 other patient appointment' ORDER BY created_at DESC LIMIT 1) AS appt_b;
`);

const row = ids.rows?.[0];
if (!row?.patient_a || !row?.appt_a) {
  throw new Error(`Seed incomplete: ${JSON.stringify(ids)}`);
}

const validToken = token();
const expiredToken = token();
const revokedToken = token();
const otherPatientToken = token();
const scopes = `ARRAY['appointments:read','appointments:cancel','consent:write']::text[]`;

dbFile(`
DELETE FROM public.patient_portal_sessions
WHERE patient_id IN (
  '${row.patient_a}'::uuid,
  '${row.patient_b}'::uuid
)
AND created_at > now() - interval '1 day';

INSERT INTO public.patient_portal_sessions (
  clinic_id, patient_id, token_hash, scopes, expires_at, revoked_at, created_at
) VALUES
(
  'a0000000-0000-4000-8000-000000000001',
  '${row.patient_a}'::uuid,
  decode('${hashHex(validToken)}', 'hex'),
  ${scopes},
  now() + interval '30 minutes',
  NULL,
  now()
),
(
  'a0000000-0000-4000-8000-000000000001',
  '${row.patient_a}'::uuid,
  decode('${hashHex(expiredToken)}', 'hex'),
  ${scopes},
  now() - interval '5 minutes',
  NULL,
  now() - interval '40 minutes'
),
(
  'a0000000-0000-4000-8000-000000000001',
  '${row.patient_a}'::uuid,
  decode('${hashHex(revokedToken)}', 'hex'),
  ${scopes},
  now() + interval '30 minutes',
  now(),
  now()
),
(
  'a0000000-0000-4000-8000-000000000001',
  '${row.patient_b}'::uuid,
  decode('${hashHex(otherPatientToken)}', 'hex'),
  ${scopes},
  now() + interval '30 minutes',
  NULL,
  now()
);
`);

const envPath = resolve(process.cwd(), "e2e/.phase6-env.local");
writeFileSync(
  envPath,
  [
    `E2E_BOOKING_SLUG=centro-medico-norte-turnos`,
    `E2E_BOOKING_SLUG_B=mi-clinica-abuelitos`,
    `E2E_PHASE6_PATIENT_A=${row.patient_a}`,
    `E2E_PHASE6_PATIENT_B=${row.patient_b}`,
    `E2E_PHASE6_PATIENT_EXISTING=${row.patient_existing}`,
    `E2E_PHASE6_APPT_A=${row.appt_a}`,
    `E2E_PHASE6_APPT_B=${row.appt_b}`,
    `E2E_PHASE6_TOKEN_VALID=${validToken}`,
    `E2E_PHASE6_TOKEN_EXPIRED=${expiredToken}`,
    `E2E_PHASE6_TOKEN_REVOKED=${revokedToken}`,
    `E2E_PHASE6_TOKEN_OTHER_PATIENT=${otherPatientToken}`,
    `E2E_PHASE6_DOC_EXISTING=90060003`,
    `E2E_PHASE6_PROFESSIONAL_ID=b0000000-0000-4000-8000-000000000001`,
  ].join("\n") + "\n",
  "utf8"
);

console.log("OK: synthetic staging seed ready");
console.log(`Wrote ${envPath} (do not commit; tokens not printed)`);
console.log(`patient_a=${row.patient_a}`);
console.log(`appt_a=${row.appt_a}`);
