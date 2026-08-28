#!/usr/bin/env node
/**
 * Ensures a synthetic clinical record exists for Phase 6 patient A (staging QA only).
 */
import { existsSync,readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createClient } from "@supabase/supabase-js";

import { loadEnv } from "./_env.mjs";
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

function loadPhase6PatientA() {
  const path = resolve(process.cwd(), "e2e/.phase6-env.local");
  if (!existsSync(path)) return null;
  const m = readFileSync(path, "utf8").match(/^E2E_PHASE6_PATIENT_A=(.+)$/m);
  return m?.[1]?.trim() ?? null;
}

const patientA = loadPhase6PatientA();
if (!patientA) fail("Missing E2E_PHASE6_PATIENT_A in e2e/.phase6-env.local");

const env = loadEnv({ required: true });
const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !serviceKey) fail("Missing staging Supabase URL or service role key.");
if (url.includes(PRODUCTION_REF)) fail("Refusing production Supabase URL.");

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const clinicId = "a0000000-0000-4000-8000-000000000001";
const professionalId = "b0000000-0000-4000-8000-000000000001";
const marker = "E2E Phase6 release gate synthetic HC";

const { data: existing, error: existingError } = await admin
  .from("clinical_records")
  .select("id")
  .eq("patient_id", patientA)
  .eq("chief_complaint", marker)
  .maybeSingle();

if (existingError) fail(`Lookup failed: ${existingError.message}`);
if (existing?.id) {
  console.log(`OK: clinical record already present (id=${existing.id})`);
  process.exit(0);
}

const { data: e2eUser } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
const createdBy =
  e2eUser?.users?.find((u) => u.email === "drflow-release-qa@staging.drflow.invalid")?.id ??
  null;

const { data: inserted, error: insertError } = await admin
  .from("clinical_records")
  .insert({
    clinic_id: clinicId,
    patient_id: patientA,
    professional_id: professionalId,
    chief_complaint: marker,
    diagnosis: "E2E QA synthetic diagnosis",
    evolution: "E2E QA synthetic evolution",
    indications: "E2E QA synthetic indications",
    created_by: createdBy,
  })
  .select("id")
  .single();

if (insertError || !inserted) {
  fail(`Insert failed: ${insertError?.message ?? "no row"}`);
}

console.log(`OK: created synthetic clinical record (id=${inserted.id})`);
process.exit(0);
