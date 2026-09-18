#!/usr/bin/env node
/**
 * Phase 3 — live JWT tenant isolation probes (STAGING ONLY).
 * Proves cross-clinic read/write denial and patient mismatch rejection with real sessions.
 *
 * Prerequisites:
 *   node scripts/configure-staging-e2e-account.mjs
 *   npm run phase6:seed:staging-e2e
 *   node scripts/ensure-phase6-clinical-record.mjs
 *   node scripts/phase3-seed-staging-tenant-fixtures.mjs
 *   node scripts/configure-staging-tenant-b-account.mjs
 *
 * Usage: node scripts/qa-staging-tenant-isolation.mjs [--json]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { createClient } from "@supabase/supabase-js";

import { loadEnv, resolveSupabaseAnonKey } from "./_env.mjs";
import {
  requirePhase3Env,
  STAGING_TENANT_A_EMAIL,
  STAGING_TENANT_B_EMAIL,
} from "./lib/tenant-isolation-env.mjs";
import {
  assertLinkedStagingOrExit,
  PRODUCTION_REF,
  readLinkedProjectRef,
  STAGING_REF,
} from "./supabase-project-refs.mjs";

const writeJson = process.argv.includes("--json");
const results = [];
let p0Leak = false;

function fail(msg) {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

function record(scenario, expected, actual, ok, extra = {}) {
  results.push({ scenario, expected, actual, ok, ...extra });
  const tag = ok ? "PASS" : "FAIL";
  console.log(`${tag} — ${scenario}`);
  if (!ok) {
    console.log(`  expected: ${expected}`);
    console.log(`  actual: ${actual}`);
    if (extra.severity === "P0") p0Leak = true;
  }
}

assertLinkedStagingOrExit();
if (readLinkedProjectRef() !== STAGING_REF) {
  fail(`CLI must be linked to staging (${STAGING_REF}).`);
}

const fixtures = requirePhase3Env();
if (!fixtures) {
  fail("Missing e2e/.phase3-tenant-env.local — run phase3 seed + tenant B account scripts.");
}

const env = loadEnv({ required: true });
const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const anonKey = resolveSupabaseAnonKey(env);
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const emailA = env.E2E_EMAIL?.trim() ?? STAGING_TENANT_A_EMAIL;
const passwordA = env.E2E_PASSWORD?.trim();
const emailB = env.E2E_TENANT_B_EMAIL?.trim() ?? STAGING_TENANT_B_EMAIL;
const passwordB = env.E2E_TENANT_B_PASSWORD?.trim();

if (!url || !anonKey) fail("Missing NEXT_PUBLIC_SUPABASE_URL or anon key.");
if (url.includes(PRODUCTION_REF)) fail("Refusing production Supabase URL.");
if (!passwordA || !passwordB) {
  fail("Missing E2E_PASSWORD / E2E_TENANT_B_PASSWORD — run configure-staging-* scripts.");
}

async function signIn(email, password) {
  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    throw new Error(`Sign-in failed for ${email}: ${error?.message ?? "no session"}`);
  }
  return client;
}

async function snapshotRecord(client, recordId) {
  const { data } = await client
    .from("clinical_records")
    .select(
      "patient_id, clinic_id, professional_id, chief_complaint, diagnosis, evolution, indications, updated_at"
    )
    .eq("id", recordId)
    .maybeSingle();
  return data;
}

async function runUserAProbes(client) {
  const {
    PHASE3_CLINIC_A: clinicA,
    PHASE3_CLINIC_B: clinicB,
    PHASE3_PATIENT_A: patientA,
    PHASE3_PATIENT_B: patientB,
    PHASE3_RECORD_A: recordA,
    PHASE3_RECORD_B: recordB,
    PHASE3_SAME_CLINIC_PATIENT_B: sameClinicPatientB,
    PHASE3_ATTACHMENT_B_PATH: attachPathB,
  } = fixtures;

  const { data: readA, error: readAErr } = await client
    .from("patients")
    .select("id, clinic_id, document_number")
    .eq("id", patientA)
    .maybeSingle();
  record(
    "User A SELECT patient A",
    "row returned with clinic A",
    readAErr?.message ?? (readA ? `clinic=${readA.clinic_id}` : "null"),
    !readAErr && readA?.clinic_id === clinicA,
    { table: "patients", operation: "SELECT" }
  );

  const { data: readB, error: readBErr } = await client
    .from("patients")
    .select("id, clinic_id")
    .eq("id", patientB)
    .maybeSingle();
  record(
    "User A SELECT patient B (cross-clinic)",
    "zero rows / null",
    readBErr?.message ?? (readB ? `LEAK clinic=${readB.clinic_id}` : "null"),
    !readB && !readBErr,
    { table: "patients", operation: "SELECT", severity: readB ? "P0" : undefined }
  );

  const { data: recordRowB } = await client
    .from("clinical_records")
    .select("id, clinic_id, patient_id")
    .eq("id", recordB)
    .maybeSingle();
  record(
    "User A SELECT clinical_record B",
    "zero rows",
    recordRowB ? `LEAK id=${recordRowB.id}` : "null",
    !recordRowB,
    { table: "clinical_records", operation: "SELECT", severity: recordRowB ? "P0" : undefined }
  );

  const beforeUpdateB = await snapshotRecord(
    createClient(url, serviceKey, { auth: { persistSession: false } }),
    recordB
  );
  const { data: updateBRows, error: updateBErr } = await client
    .from("patients")
    .update({ phone: "9999999999" })
    .eq("id", patientB)
    .select("id");
  const adminAfterB = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: afterPatientB } = await adminAfterB
    .from("patients")
    .select("phone")
    .eq("id", patientB)
    .maybeSingle();
  record(
    "User A UPDATE patient B",
    "no mutation",
    updateBErr?.message ?? `rows=${updateBRows?.length ?? 0} phone=${afterPatientB?.phone}`,
    (updateBRows?.length ?? 0) === 0,
    { table: "patients", operation: "UPDATE", severity: (updateBRows?.length ?? 0) > 0 ? "P0" : undefined }
  );

  const { data: deleteBRows, error: deleteBErr } = await client
    .from("clinical_records")
    .delete()
    .eq("id", recordB)
    .select("id");
  const { data: stillB } = await adminAfterB
    .from("clinical_records")
    .select("id")
    .eq("id", recordB)
    .maybeSingle();
  record(
    "User A DELETE clinical_record B",
    "record still exists",
    deleteBErr?.message ?? `deleted=${deleteBRows?.length ?? 0} exists=${Boolean(stillB)}`,
    Boolean(stillB) && (deleteBRows?.length ?? 0) === 0,
    {
      table: "clinical_records",
      operation: "DELETE",
      severity: !stillB ? "P0" : undefined,
    }
  );

  const { data: userData } = await client.auth.getUser();
  const userId = userData.user?.id;
  const { data: rpcCross, error: rpcCrossErr } = await client.rpc("update_clinical_record_atomic", {
    p_clinic_id: clinicB,
    p_record_id: recordB,
    p_patient_id: patientB,
    p_professional_id: null,
    p_appointment_id: null,
    p_chief_complaint: "cross-tenant probe",
    p_diagnosis: "",
    p_evolution: "",
    p_indications: "",
    p_updated_by: userId,
  });
  const rpcCrossMsg = rpcCrossErr?.message ?? rpcCross?.error ?? JSON.stringify(rpcCross);
  record(
    "User A RPC update_clinical_record_atomic (Clinic B)",
    "FORBIDDEN or RECORD_NOT_FOUND",
    rpcCrossMsg,
    /FORBIDDEN|RECORD_NOT_FOUND|permission|JWT/i.test(String(rpcCrossMsg)),
    { rpc: "update_clinical_record_atomic", operation: "RPC", severity: /PATIENT_MISMATCH/i.test(String(rpcCrossMsg)) ? undefined : undefined }
  );

  if (sameClinicPatientB) {
    const before = await snapshotRecord(client, recordA);
    const { error: mismatchErr } = await client.rpc("update_clinical_record_atomic", {
      p_clinic_id: clinicA,
      p_record_id: recordA,
      p_patient_id: sameClinicPatientB,
      p_professional_id: before?.professional_id ?? null,
      p_appointment_id: null,
      p_chief_complaint: before?.chief_complaint ?? "qa",
      p_diagnosis: before?.diagnosis ?? "",
      p_evolution: before?.evolution ?? "",
      p_indications: before?.indications ?? "",
      p_updated_by: userId,
    });
    const after = await snapshotRecord(client, recordA);
    const mismatch =
      /PATIENT_MISMATCH/i.test(mismatchErr?.message ?? "") ||
      /PATIENT_MISMATCH/i.test(JSON.stringify(mismatchErr ?? {}));
    const unchanged =
      before &&
      after &&
      before.patient_id === after.patient_id &&
      before.chief_complaint === after.chief_complaint &&
      before.updated_at === after.updated_at;
    record(
      "User A PATIENT_MISMATCH (record A + patient B id, same clinic)",
      "PATIENT_MISMATCH + no mutation",
      mismatchErr?.message ?? "ok",
      mismatch && unchanged,
      { rpc: "update_clinical_record_atomic", operation: "RPC" }
    );
  }

  const { data: signed, error: signedErr } = await client.storage
    .from("clinical-files")
    .createSignedUrl(attachPathB, 60);
  record(
    "User A storage signed URL (Clinic B attachment path)",
    "denied / no signedUrl",
    signedErr?.message ?? (signed?.signedUrl ? "LEAK signedUrl" : "null"),
    !signed?.signedUrl,
    {
      table: "storage.objects",
      operation: "SELECT",
      severity: signed?.signedUrl ? "P0" : undefined,
    }
  );

  const { data: listFiles, error: listErr } = await client.storage
    .from("clinical-files")
    .list(`${clinicB}/${patientB}`, { limit: 5 });
  record(
    "User A storage list (Clinic B prefix)",
    "empty or denied",
    listErr?.message ?? `count=${listFiles?.length ?? 0}`,
    (listFiles?.length ?? 0) === 0,
    {
      table: "storage.objects",
      operation: "SELECT",
      severity: (listFiles?.length ?? 0) > 0 ? "P0" : undefined,
    }
  );

  void beforeUpdateB;
}

async function runUserBProbes(client) {
  const {
    PHASE3_CLINIC_B: clinicB,
    PHASE3_PATIENT_B: patientB,
    PHASE3_PATIENT_A: patientA,
    PHASE3_RECORD_B: recordB,
  } = fixtures;

  const { data: readB } = await client
    .from("patients")
    .select("id, clinic_id")
    .eq("id", patientB)
    .maybeSingle();
  record(
    "User B SELECT patient B",
    "row returned with clinic B",
    readB ? `clinic=${readB.clinic_id}` : "null",
    readB?.clinic_id === clinicB,
    { table: "patients", operation: "SELECT" }
  );

  const { data: readA } = await client
    .from("patients")
    .select("id")
    .eq("id", patientA)
    .maybeSingle();
  record(
    "User B SELECT patient A (cross-clinic)",
    "zero rows",
    readA ? `LEAK id=${readA.id}` : "null",
    !readA,
    { table: "patients", operation: "SELECT", severity: readA ? "P0" : undefined }
  );

  const { data: recordRowA } = await client
    .from("clinical_records")
    .select("id")
    .eq("id", fixtures.PHASE3_RECORD_A)
    .maybeSingle();
  record(
    "User B SELECT clinical_record A",
    "zero rows",
    recordRowA ? `LEAK id=${recordRowA.id}` : "null",
    !recordRowA,
    { table: "clinical_records", operation: "SELECT", severity: recordRowA ? "P0" : undefined }
  );

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: stillB } = await admin
    .from("clinical_records")
    .select("id")
    .eq("id", recordB)
    .maybeSingle();
  record(
    "User B inverse — record B still intact after User A probes",
    "record exists",
    stillB ? "exists" : "missing",
    Boolean(stillB),
    { table: "clinical_records", operation: "VERIFY" }
  );
}

async function runAuditProbe(clientA) {
  const { PHASE3_CLINIC_A: clinicA, PHASE3_PATIENT_A: patientA, PHASE3_RECORD_A: recordA } =
    fixtures;
  const { data: userData } = await clientA.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return;

  const before = await snapshotRecord(clientA, recordA);
  const auditMarker = `phase3-audit-probe-${Date.now()}`;
  const { error: rpcErr } = await clientA.rpc("update_clinical_record_atomic", {
    p_clinic_id: clinicA,
    p_record_id: recordA,
    p_patient_id: patientA,
    p_professional_id: before?.professional_id ?? null,
    p_appointment_id: null,
    p_chief_complaint: auditMarker,
    p_diagnosis: before?.diagnosis ?? "",
    p_evolution: before?.evolution ?? "",
    p_indications: before?.indications ?? "",
    p_updated_by: userId,
    p_audit_what: "Phase3 authorized audit probe",
  });

  const { data: auditRows } = await clientA
    .from("clinical_record_audit")
    .select("id, clinic_id, patient_id, clinical_record_id, action, changed_at")
    .eq("clinical_record_id", recordA)
    .order("changed_at", { ascending: false })
    .limit(1);

  const audit = auditRows?.[0];
  record(
    "Authorized mutation audit trail",
    "audit row with clinic_id + patient_id + clinical_record_id",
    rpcErr?.message ?? (audit ? `action=${audit.action}` : "no audit row"),
    !rpcErr &&
      audit?.clinic_id === clinicA &&
      audit?.patient_id === patientA &&
      audit?.clinical_record_id === recordA,
    { table: "clinical_record_audit", operation: "AUDIT" }
  );

  if (before && !rpcErr) {
    await clientA.rpc("update_clinical_record_atomic", {
      p_clinic_id: clinicA,
      p_record_id: recordA,
      p_patient_id: patientA,
      p_professional_id: before.professional_id,
      p_appointment_id: null,
      p_chief_complaint: before.chief_complaint ?? "E2E",
      p_diagnosis: before.diagnosis ?? "",
      p_evolution: before.evolution ?? "",
      p_indications: before.indications ?? "",
      p_updated_by: userId,
    });
  }
}

console.log("Phase 3 — live JWT tenant isolation probes (staging)\n");

const clientA = await signIn(emailA, passwordA);
await runUserAProbes(clientA);
await runAuditProbe(clientA);

const clientB = await signIn(emailB, passwordB);
await runUserBProbes(clientB);

const failed = results.filter((r) => !r.ok);
const report = {
  captured_at: new Date().toISOString(),
  staging_ref: STAGING_REF,
  identities: {
    user_a: STAGING_TENANT_A_EMAIL,
    user_b: STAGING_TENANT_B_EMAIL,
  },
  fixtures: {
    clinic_a: fixtures.PHASE3_CLINIC_A,
    clinic_b: fixtures.PHASE3_CLINIC_B,
  },
  summary: {
    total: results.length,
    passed: results.filter((r) => r.ok).length,
    failed: failed.length,
    p0_leak: p0Leak || failed.some((r) => r.severity === "P0"),
  },
  results,
};

const outDir = resolve(process.cwd(), "coverage");
mkdirSync(outDir, { recursive: true });
const outPath = resolve(outDir, "staging-tenant-isolation.json");
writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

if (writeJson) {
  console.log(JSON.stringify(report, null, 2));
}

console.log(`\nReport: ${outPath}`);
console.log(`Passed ${report.summary.passed}/${report.summary.total}`);

if (p0Leak || failed.some((r) => r.severity === "P0")) {
  fail("P0 tenant leak detected — stopping.");
}

if (failed.length > 0) {
  fail(`${failed.length} probe(s) failed.`);
}

console.log("\nPASS — Phase 3 tenant isolation probes");
process.exit(0);
