#!/usr/bin/env node
/**
 * Phase 5 — synthetic recovery fixture (staging only).
 * Creates marker patient + clinical record + audit event with checksum.
 */
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { createClient } from "@supabase/supabase-js";

import { loadEnv } from "../_env.mjs";
import { CLINIC_A_ID } from "../lib/tenant-isolation-env.mjs";
import {
  assertLinkedStagingOrExit,
  PRODUCTION_REF,
  readLinkedProjectRef,
  STAGING_REF,
} from "../supabase-project-refs.mjs";
import { PHASE5_DR_ENV_PATH } from "./paths.mjs";
const MARKER = "PHASE5-DR-SYNTHETIC-v1";
const DOC = "99050001";
const PROFESSIONAL_ID = "b0000000-0000-4000-8000-000000000001";

function checksum(payload) {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

function fail(msg) {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

assertLinkedStagingOrExit();
if (readLinkedProjectRef() !== STAGING_REF) {
  fail(`CLI must be linked to staging (${STAGING_REF}).`);
}

const env = loadEnv({ required: true });
const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !serviceKey) fail("Missing Supabase URL or service role key.");
if (url.includes(PRODUCTION_REF)) fail("Refusing production Supabase URL.");

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: e2eUser } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
const createdBy =
  e2eUser?.users?.find((u) => u.email === "drflow-release-qa@staging.drflow.invalid")?.id ?? null;

const seededAt = new Date().toISOString();

let patientId = null;
const { data: existing } = await admin
  .from("patients")
  .select("id")
  .eq("clinic_id", CLINIC_A_ID)
  .eq("document_number", DOC)
  .maybeSingle();

if (existing?.id) {
  patientId = existing.id;
  await admin
    .from("patients")
    .update({
      first_name: "Phase5DR",
      last_name: "Synthetic",
      phone: "5550001111",
      email: "phase5-dr@staging.drflow.invalid",
      updated_at: seededAt,
    })
    .eq("id", patientId);
} else {
  const { data: inserted, error } = await admin
    .from("patients")
    .insert({
      clinic_id: CLINIC_A_ID,
      first_name: "Phase5DR",
      last_name: "Synthetic",
      document_number: DOC,
      document_type: "dni",
      phone: "5550001111",
      email: "phase5-dr@staging.drflow.invalid",
    })
    .select("id")
    .single();
  if (error) fail(`patient insert: ${error.message}`);
  patientId = inserted.id;
}

let recordId = null;
const { data: existingRec } = await admin
  .from("clinical_records")
  .select("id, chief_complaint, evolution")
  .eq("clinic_id", CLINIC_A_ID)
  .eq("patient_id", patientId)
  .eq("chief_complaint", MARKER)
  .maybeSingle();

const recordFields = {
  chief_complaint: MARKER,
  diagnosis: "Synthetic DR drill — no PHI",
  evolution: `Automated Phase 5 recovery fixture seeded_at=${seededAt}`,
  indications: "N/A synthetic",
};

if (existingRec?.id) {
  recordId = existingRec.id;
  await admin
    .from("clinical_records")
    .update({ ...recordFields, updated_at: seededAt })
    .eq("id", recordId);
} else {
  const { data: rec, error: recErr } = await admin
    .from("clinical_records")
    .insert({
      clinic_id: CLINIC_A_ID,
      patient_id: patientId,
      professional_id: PROFESSIONAL_ID,
      created_by: createdBy,
      ...recordFields,
    })
    .select("id")
    .single();
  if (recErr) fail(`clinical record insert: ${recErr.message}`);
  recordId = rec.id;
}

const { error: auditErr } = await admin.from("audit_logs").insert({
  clinic_id: CLINIC_A_ID,
  patient_id: patientId,
  user_id: createdBy,
  module: "system",
  what: "recovery_fixture_seeded",
  entity_type: "phase5_dr_fixture",
  entity_id: recordId,
  action: "create",
  metadata: { marker: MARKER, record_id: recordId },
});
if (auditErr) fail(`audit insert: ${auditErr.message}`);

const fixture = {
  marker: MARKER,
  clinicId: CLINIC_A_ID,
  patientId,
  recordId,
  documentNumber: DOC,
  seededAt,
  dataChecksum: checksum({ patientId, recordId, recordFields, clinicId: CLINIC_A_ID }),
};

mkdirSync(resolve(process.cwd(), "e2e"), { recursive: true });
writeFileSync(
  PHASE5_DR_ENV_PATH,
  [
    `PHASE5_DR_MARKER=${MARKER}`,
    `PHASE5_DR_CLINIC_ID=${CLINIC_A_ID}`,
    `PHASE5_DR_PATIENT_ID=${patientId}`,
    `PHASE5_DR_RECORD_ID=${recordId}`,
    `PHASE5_DR_CHECKSUM=${fixture.dataChecksum}`,
    `PHASE5_DR_SEEDED_AT=${seededAt}`,
  ].join("\n") + "\n",
  "utf8"
);

writeFileSync(
  resolve(process.cwd(), "coverage/phase5-recovery-fixture.json"),
  `${JSON.stringify(fixture, null, 2)}\n`,
  "utf8"
);

console.log("\n✅ Phase 5 DR fixture seeded (staging)\n");
console.log(`   Patient: ${patientId}`);
console.log(`   Record:  ${recordId}`);
console.log(`   Checksum: ${fixture.dataChecksum.slice(0, 16)}…`);
console.log(`\n→ ${PHASE5_DR_ENV_PATH}\n`);
