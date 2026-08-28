#!/usr/bin/env node
/**
 * Authenticated PATIENT_MISMATCH probe — STAGING ONLY.
 * Requires E2E_EMAIL + E2E_PASSWORD in .env.local (clinical write user).
 *
 * Usage: node scripts/qa-staging-patient-mismatch-auth.mjs
 */
import { existsSync,readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createClient } from "@supabase/supabase-js";

import { loadEnv, resolveSupabaseAnonKey } from "./_env.mjs";
import {
  assertLinkedStagingOrExit,
  PRODUCTION_REF,
  readLinkedProjectRef,
} from "./supabase-project-refs.mjs";

function fail(msg) {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

assertLinkedStagingOrExit();
if (readLinkedProjectRef() !== "gprmsufvhabntbrytwyi") {
  fail("CLI must be linked to staging.");
}

const env = loadEnv({ required: true });
const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const anonKey = resolveSupabaseAnonKey(env);
const email = env.E2E_EMAIL?.trim() ?? process.env.E2E_EMAIL?.trim();
const password = env.E2E_PASSWORD?.trim() ?? process.env.E2E_PASSWORD?.trim();

if (!url || !anonKey) fail("Missing NEXT_PUBLIC_SUPABASE_URL or anon/publishable key.");
if (url.includes(PRODUCTION_REF)) fail("Refusing production Supabase URL.");
if (!email || !password) fail("Missing E2E_EMAIL / E2E_PASSWORD for authenticated probe.");

function loadPhase6Patients() {
  const path = resolve(process.cwd(), "e2e/.phase6-env.local");
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^E2E_PHASE6_PATIENT_(A|B)=(.+)$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

const patients = loadPhase6Patients();
const patientA = patients.A;
const patientB = patients.B;
if (!patientA || !patientB) fail("Missing E2E_PHASE6_PATIENT_A/B in e2e/.phase6-env.local");

const supabase = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: signIn, error: signInError } = await supabase.auth.signInWithPassword({
  email,
  password,
});
if (signInError || !signIn.user) fail(`Sign-in failed: ${signInError?.message ?? "no user"}`);

const { data: record, error: recordError } = await supabase
  .from("clinical_records")
  .select(
    "id, clinic_id, patient_id, professional_id, chief_complaint, diagnosis, evolution, indications, updated_at"
  )
  .eq("patient_id", patientA)
  .limit(1)
  .maybeSingle();

if (recordError || !record) fail(`No clinical record for patient A: ${recordError?.message ?? "none"}`);

const before = {
  patient_id: record.patient_id,
  clinic_id: record.clinic_id,
  chief_complaint: record.chief_complaint,
  diagnosis: record.diagnosis,
  evolution: record.evolution,
  indications: record.indications,
  updated_at: record.updated_at,
};

const { data: rpcData, error: rpcError } = await supabase.rpc("update_clinical_record_atomic", {
  p_clinic_id: record.clinic_id,
  p_record_id: record.id,
  p_patient_id: patientB,
  p_professional_id: record.professional_id,
  p_appointment_id: null,
  p_chief_complaint: record.chief_complaint ?? "qa",
  p_diagnosis: record.diagnosis ?? "",
  p_evolution: record.evolution ?? "",
  p_indications: record.indications ?? "",
  p_updated_by: signIn.user.id,
});

const message = rpcError?.message ?? rpcData?.error ?? "";
const mismatch =
  /PATIENT_MISMATCH/i.test(message) ||
  (rpcError && /PATIENT_MISMATCH/i.test(JSON.stringify(rpcError)));

const { data: after } = await supabase
  .from("clinical_records")
  .select(
    "patient_id, clinic_id, chief_complaint, diagnosis, evolution, indications, updated_at"
  )
  .eq("id", record.id)
  .maybeSingle();

if (!after) fail("Could not re-read clinical record after probe.");
if (after.patient_id !== before.patient_id) {
  fail(`Record patient_id changed (${before.patient_id} → ${after.patient_id}).`);
}
if (after.clinic_id !== before.clinic_id) {
  fail(`Record clinic_id changed (${before.clinic_id} → ${after.clinic_id}).`);
}
for (const field of ["chief_complaint", "diagnosis", "evolution", "indications"]) {
  if (after[field] !== before[field]) {
    fail(`Clinical field ${field} changed during probe.`);
  }
}
if (after.updated_at !== before.updated_at) {
  fail("Record updated_at changed — possible partial write.");
}

if (!mismatch) {
  fail(`Expected PATIENT_MISMATCH, got: ${message || JSON.stringify(rpcData)}`);
}

console.log("PASS — PATIENT_MISMATCH enforced");
console.log(`record_id=${record.id}`);
process.exit(0);
