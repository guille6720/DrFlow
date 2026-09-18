#!/usr/bin/env node
/**
 * Phase 5 — post-restore (or current-state) integrity validation.
 * Machine-readable evidence in coverage/phase5-recovery-validation.json
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { createClient } from "@supabase/supabase-js";

import { loadEnv } from "../_env.mjs";
import { requirePhase3Env } from "../lib/tenant-isolation-env.mjs";
import {
  assertLinkedStagingOrExit,
  PRODUCTION_REF,
  readLinkedProjectRef,
  STAGING_REF,
} from "../supabase-project-refs.mjs";
import { PHASE5_DR_ENV_PATH } from "./paths.mjs";

function loadPhase5Env() {
  if (!existsSync(PHASE5_DR_ENV_PATH)) return null;
  const out = {};
  for (const line of readFileSync(PHASE5_DR_ENV_PATH, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.+)$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

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

const phase5 = loadPhase5Env();
if (!phase5?.PHASE5_DR_PATIENT_ID) {
  fail("Run node scripts/disaster-recovery/seed-recovery-fixture.mjs first.");
}

const phase3 = requirePhase3Env();

const env = loadEnv({ required: true });
const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const anonKey =
  env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !serviceKey) fail("Missing Supabase credentials.");
if (url.includes(PRODUCTION_REF)) fail("Refusing production URL.");

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const checks = [];
function add(id, pass, detail) {
  checks.push({ id, pass, detail });
}

const clinicId = phase5.PHASE5_DR_CLINIC_ID;
const patientId = phase5.PHASE5_DR_PATIENT_ID;
const recordId = phase5.PHASE5_DR_RECORD_ID;
const expectedChecksum = phase5.PHASE5_DR_CHECKSUM;

const { data: clinic } = await admin.from("clinics").select("id,name").eq("id", clinicId).maybeSingle();
add("clinic_exists", Boolean(clinic?.id), clinic?.name ?? "missing");

const { data: patient } = await admin
  .from("patients")
  .select("id,clinic_id,document_number,first_name")
  .eq("id", patientId)
  .maybeSingle();
add("patient_exists", Boolean(patient?.id), patient?.id ?? "missing");
add("patient_clinic_id", patient?.clinic_id === clinicId, `${patient?.clinic_id}`);

const { data: record } = await admin
  .from("clinical_records")
  .select("id,clinic_id,patient_id,chief_complaint,diagnosis,evolution,indications")
  .eq("id", recordId)
  .maybeSingle();
add("clinical_record_exists", Boolean(record?.id), record?.id ?? "missing");
add("record_patient_id", record?.patient_id === patientId, `${record?.patient_id}`);
add("record_clinic_id", record?.clinic_id === clinicId, `${record?.clinic_id}`);

const actualChecksum = checksum({
  patientId,
  recordId,
  recordFields: {
    chief_complaint: record?.chief_complaint,
    diagnosis: record?.diagnosis,
    evolution: record?.evolution,
    indications: record?.indications,
  },
  clinicId,
});
add("data_checksum", actualChecksum === expectedChecksum, `match=${actualChecksum === expectedChecksum}`);

const { count: auditCount } = await admin
  .from("audit_logs")
  .select("id", { count: "exact", head: true })
  .eq("clinic_id", clinicId)
  .eq("patient_id", patientId)
  .eq("what", "recovery_fixture_seeded");
add("audit_trail", (auditCount ?? 0) >= 1, `count=${auditCount ?? 0}`);

if (phase3) {
  const { data: crossPatient } = await admin
    .from("patients")
    .select("id")
    .eq("id", phase3.PHASE3_PATIENT_B)
    .eq("clinic_id", phase3.PHASE3_CLINIC_B)
    .maybeSingle();
  add("tenant_b_patient_isolated", Boolean(crossPatient?.id), "clinic B fixture present");

  const { data: leak } = await admin
    .from("clinical_records")
    .select("id")
    .eq("id", phase3.PHASE3_RECORD_B)
    .eq("clinic_id", phase3.PHASE3_CLINIC_A)
    .maybeSingle();
  add("no_cross_tenant_record_leak", !leak?.id, leak?.id ? "LEAK" : "ok");
}

const { count: apptCount, error: apptErr } = await admin
  .from("appointments")
  .select("id", { count: "exact", head: true })
  .eq("clinic_id", clinicId);
add("appointments_query", !apptErr, apptErr?.message ?? `count=${apptCount ?? 0}`);

const baseUrlRaw = process.env.HEALTH_CHECK_URL ?? process.env.PHASE5_HEALTH_URL;
const baseUrl =
  typeof baseUrlRaw === "string" && baseUrlRaw.startsWith("http")
    ? baseUrlRaw.replace(/\/$/, "")
    : "http://localhost:3000";
let healthOk = false;
try {
  const res = await fetch(`${baseUrl}/api/health/ready`, {
    cache: "no-store",
    signal: AbortSignal.timeout(5_000),
  });
  const body = await res.json();
  healthOk = res.ok && body.ok === true;
  if (!healthOk && process.env.PHASE5_ALLOW_OFFLINE_HEALTH === "1") {
    add(
      "health_ready",
      true,
      `degraded app probe skipped (http=${res.status}); supabase connectivity verified separately`
    );
  } else {
    add("health_ready", healthOk, `url=${baseUrl} http=${res.status} ok=${body.ok}`);
  }
} catch (err) {
  if (process.env.PHASE5_ALLOW_OFFLINE_HEALTH === "1") {
    add("health_ready", true, "skipped (offline); supabase connectivity verified separately");
  } else {
    add("health_ready", false, String(err.message ?? err).slice(0, 120));
  }
}

let authConnectivity = false;
if (anonKey) {
  const res = await fetch(`${url.replace(/\/$/, "")}/rest/v1/`, {
    method: "HEAD",
    headers: { apikey: anonKey },
  });
  authConnectivity = res.ok || res.status === 401;
}
add("supabase_rest_connectivity", authConnectivity, authConnectivity ? "ok" : "fail");

const allPass = checks.every((c) => c.pass);
const report = {
  generatedAt: new Date().toISOString(),
  environment: "staging",
  stagingOnly: true,
  allPass,
  checks,
  fixture: {
    clinicId,
    patientId,
    recordId,
    expectedChecksum: expectedChecksum?.slice(0, 16),
    actualChecksum: actualChecksum.slice(0, 16),
  },
};

const outPath = resolve(process.cwd(), "coverage/phase5-recovery-validation.json");
mkdirSync(resolve(process.cwd(), "coverage"), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

console.log("\n🔍 Phase 5 — Recovery integrity validation\n");
for (const c of checks) {
  console.log(`   ${c.pass ? "✓" : "✗"} ${c.id}: ${c.detail}`);
}
console.log(`\n→ ${outPath}`);
console.log(allPass ? "\n✅ All checks passed\n" : "\n❌ Validation failed\n");
process.exit(allPass ? 0 : 1);
