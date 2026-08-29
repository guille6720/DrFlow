#!/usr/bin/env node
/**
 * Phase 7B post-write validation — audit samples + integrity (STAGING ONLY).
 * Reads synthetic LOADTEST records; never prints PHI/secrets.
 *
 * Usage: node scripts/phase7b-post-write-validate.mjs
 */
import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createClient } from "@supabase/supabase-js";

import { loadEnv } from "./_env.mjs";
import {
  assertLinkedStagingOrExit,
  PRODUCTION_REF,
  STAGING_REF,
} from "./supabase-project-refs.mjs";

function fail(msg) {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

assertLinkedStagingOrExit();
const env = loadEnv({ required: true });
const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !serviceKey) fail("Missing Supabase credentials.");
if (url.includes(PRODUCTION_REF)) fail("Refusing production.");

const fixturesPath = resolve(process.cwd(), "coverage/load/clinical-write-fixtures.json");
if (!existsSync(fixturesPath)) fail("Missing clinical-write-fixtures.json");
const fixtures = JSON.parse(readFileSync(fixturesPath, "utf8"));

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const sample = (fixtures.records || []).slice(0, 25);
let auditMissing = 0;
let patientMismatch = 0;
let tenantMismatch = 0;
let readbackOk = 0;
const samples = [];

for (const rec of sample) {
  const { data: row, error } = await admin
    .from("clinical_records")
    .select("id, clinic_id, patient_id, professional_id, diagnosis, updated_at, record_version")
    .eq("id", rec.id)
    .maybeSingle();

  if (error || !row) {
    tenantMismatch += 1;
    continue;
  }
  if (row.clinic_id !== rec.clinic_id) tenantMismatch += 1;
  if (row.patient_id !== rec.patient_id) patientMismatch += 1;
  if (String(row.diagnosis || "").includes("synthetic load test")) readbackOk += 1;

  const { data: audits, error: auditError } = await admin
    .from("clinical_record_audit")
    .select("id, clinic_id, clinical_record_id, action, changed_at, changed_by")
    .eq("clinical_record_id", rec.id)
    .eq("clinic_id", rec.clinic_id)
    .order("changed_at", { ascending: false })
    .limit(5);

  if (auditError || !audits?.length) auditMissing += 1;

  samples.push({
    record_id: rec.id,
    clinic_id: rec.clinic_id,
    has_synthetic_diagnosis: String(row.diagnosis || "").includes("synthetic load test"),
    record_version: row.record_version ?? null,
    audit_rows: audits?.length ?? 0,
    audit_actions: (audits || []).map((a) => a.action),
  });
}

// Cross-clinic probe: Clinic A record must not appear under Clinic B filter
let crossClinicLeak = 0;
if (fixtures.clinics?.length >= 2 && sample[0]) {
  const foreignClinic = fixtures.clinics.find((c) => c.id !== sample[0].clinic_id);
  if (foreignClinic) {
    const { data: leak } = await admin
      .from("clinical_records")
      .select("id")
      .eq("id", sample[0].id)
      .eq("clinic_id", foreignClinic.id)
      .maybeSingle();
    if (leak?.id) crossClinicLeak += 1;
  }
}

const report = {
  generatedAt: new Date().toISOString(),
  stagingRef: STAGING_REF,
  sampled: sample.length,
  readbackOk,
  auditMissing,
  patientMismatch,
  tenantMismatch,
  crossClinicLeak,
  pass:
    auditMissing === 0 &&
    patientMismatch === 0 &&
    tenantMismatch === 0 &&
    crossClinicLeak === 0 &&
    readbackOk >= Math.min(1, sample.length),
  samples,
};

mkdirSync(resolve(process.cwd(), "coverage/load"), { recursive: true });
writeFileSync(
  resolve(process.cwd(), "coverage/load/write-post-validation.json"),
  JSON.stringify(report, null, 2),
  "utf8"
);

console.log("Phase 7B post-write validation");
console.log(`  sampled: ${report.sampled}`);
console.log(`  readbackOk: ${report.readbackOk}`);
console.log(`  auditMissing: ${report.auditMissing}`);
console.log(`  patientMismatch: ${report.patientMismatch}`);
console.log(`  tenantMismatch: ${report.tenantMismatch}`);
console.log(`  crossClinicLeak: ${report.crossClinicLeak}`);
console.log(`  PASS: ${report.pass}`);
if (!report.pass) process.exit(2);
