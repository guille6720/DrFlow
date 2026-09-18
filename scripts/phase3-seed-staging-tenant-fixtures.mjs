#!/usr/bin/env node
/**
 * Phase 3 — synthetic cross-clinic fixtures (STAGING ONLY).
 * Clinic A: existing phase6 patient A + clinical record.
 * Clinic B: patient B + clinical record + attachment metadata (resolved via booking slug).
 *
 * Usage: node scripts/phase3-seed-staging-tenant-fixtures.mjs
 */
import { writeFileSync } from "node:fs";

import { createClient } from "@supabase/supabase-js";

import { loadEnv } from "./_env.mjs";
import { stagingDbQuery } from "./lib/staging-db-query.mjs";
import {
  CLINIC_A_ID,
  loadPhase6PatientIds,
  PHASE3_ENV_PATH,
} from "./lib/tenant-isolation-env.mjs";
import {
  assertLinkedStagingOrExit,
  PRODUCTION_REF,
  readLinkedProjectRef,
  STAGING_REF,
} from "./supabase-project-refs.mjs";

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
if (!url || !serviceKey) fail("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
if (url.includes(PRODUCTION_REF)) fail("Refusing production Supabase URL.");

const phase6 = loadPhase6PatientIds();
if (!phase6.A) {
  fail("Missing E2E_PHASE6_PATIENT_A — run npm run phase6:seed:staging-e2e first.");
}

const clinicBResult = stagingDbQuery(`
SELECT clinic_id::text AS clinic_b
FROM public.public_booking_links
WHERE slug = 'mi-clinica-abuelitos' AND is_active = true
LIMIT 1;
`);
const clinicB = clinicBResult.rows?.[0]?.clinic_b;
if (!clinicB) fail("Clinic B not found (slug mi-clinica-abuelitos). Seed a second clinic on staging first.");

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const markerB = "E2E Phase3 tenant isolation synthetic HC (Clinic B)";
const docB = "90070001";

let patientB = null;
const { data: existingB } = await admin
  .from("patients")
  .select("id")
  .eq("clinic_id", clinicB)
  .eq("document_number", docB)
  .maybeSingle();

if (existingB?.id) {
  patientB = existingB.id;
  await admin
    .from("patients")
    .update({
      first_name: "E2EPhase3",
      last_name: "TenantB",
      phone: "4444444444",
      email: "e2e-phase3-b@example.test",
    })
    .eq("id", patientB);
} else {
  const { data: inserted, error } = await admin
    .from("patients")
    .insert({
      clinic_id: clinicB,
      first_name: "E2EPhase3",
      last_name: "TenantB",
      document_number: docB,
      phone: "4444444444",
      email: "e2e-phase3-b@example.test",
    })
    .select("id")
    .single();
  if (error || !inserted) fail(`Insert patient B failed: ${error?.message ?? "none"}`);
  patientB = inserted.id;
}

let recordB = null;
const { data: existingRecordB } = await admin
  .from("clinical_records")
  .select("id")
  .eq("clinic_id", clinicB)
  .eq("patient_id", patientB)
  .eq("chief_complaint", markerB)
  .maybeSingle();

const { data: profB } = await admin
  .from("professionals")
  .select("id, user_id")
  .eq("clinic_id", clinicB)
  .eq("is_active", true)
  .limit(1)
  .maybeSingle();

if (!profB?.id) {
  fail(`No active professional in clinic B (${clinicB}). Add one on staging before Phase 3 seed.`);
}

const { data: listedUsers } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
const tenantBUser =
  listedUsers?.users?.find((u) => u.email?.toLowerCase() === "drflow-tenant-b-qa@staging.drflow.invalid") ??
  listedUsers?.users?.find((u) => u.email === "drflow-release-qa@staging.drflow.invalid");
const createdBy = tenantBUser?.id ?? profB.user_id;
if (!createdBy) fail("Could not resolve created_by profile for clinic B clinical record.");

if (existingRecordB?.id) {
  recordB = existingRecordB.id;
} else {
  const { data: inserted, error } = await admin
    .from("clinical_records")
    .insert({
      clinic_id: clinicB,
      patient_id: patientB,
      professional_id: profB.id,
      chief_complaint: markerB,
      diagnosis: "Phase3 synthetic diagnosis B",
      evolution: "Phase3 synthetic evolution B",
      indications: "Phase3 synthetic indications B",
      created_by: createdBy,
    })
    .select("id")
    .single();
  if (error || !inserted) fail(`Insert clinical record B failed: ${error?.message ?? "none"}`);
  recordB = inserted.id;
}

const attachmentPath = `${clinicB}/${patientB}/phase3-synthetic-attachment.txt`;
const { data: existingAttach } = await admin
  .from("patient_attachments")
  .select("id")
  .eq("clinic_id", clinicB)
  .eq("patient_id", patientB)
  .eq("file_path", attachmentPath)
  .maybeSingle();

if (!existingAttach?.id) {
  const { error: attachError } = await admin.from("patient_attachments").insert({
    clinic_id: clinicB,
    patient_id: patientB,
    file_name: "phase3-synthetic-attachment.txt",
    file_path: attachmentPath,
    file_type: "text/plain",
    file_size: 12,
    category: "otro",
    uploaded_by: createdBy,
  });
  if (attachError) fail(`Insert attachment metadata failed: ${attachError.message}`);
}

const { data: recordA } = await admin
  .from("clinical_records")
  .select("id")
  .eq("clinic_id", CLINIC_A_ID)
  .eq("patient_id", phase6.A)
  .limit(1)
  .maybeSingle();

if (!recordA?.id) {
  fail("Missing clinical record for Clinic A patient — run node scripts/ensure-phase6-clinical-record.mjs");
}

writeFileSync(
  PHASE3_ENV_PATH,
  [
    `PHASE3_CLINIC_A=${CLINIC_A_ID}`,
    `PHASE3_CLINIC_B=${clinicB}`,
    `PHASE3_PATIENT_A=${phase6.A}`,
    `PHASE3_PATIENT_B=${patientB}`,
    `PHASE3_SAME_CLINIC_PATIENT_B=${phase6.B ?? ""}`,
    `PHASE3_RECORD_A=${recordA.id}`,
    `PHASE3_RECORD_B=${recordB}`,
    `PHASE3_ATTACHMENT_B_PATH=${attachmentPath}`,
    `PHASE3_DOC_A=90060001`,
    `PHASE3_DOC_B=${docB}`,
  ].join("\n") + "\n",
  "utf8"
);

console.log("OK: Phase 3 tenant fixtures ready");
console.log(`Wrote ${PHASE3_ENV_PATH} (gitignored)`);
console.log(`clinic_a=${CLINIC_A_ID}`);
console.log(`clinic_b=${clinicB}`);
console.log(`patient_b=${patientB}`);
