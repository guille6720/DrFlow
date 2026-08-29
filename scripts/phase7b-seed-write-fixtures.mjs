#!/usr/bin/env node
/**
 * Phase 7B — seed synthetic clinical WRITE fixtures (STAGING ONLY).
 * Creates LOADTEST_* clinics/professionals/patients/records/appointments.
 * Writes coverage/load/clinical-write-fixtures.json (IDs only, no credentials).
 *
 * Usage: node scripts/phase7b-seed-write-fixtures.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { createClient } from "@supabase/supabase-js";

import { loadEnv } from "./_env.mjs";
import {
  assertLinkedStagingOrExit,
  PRODUCTION_REF,
  readLinkedProjectRef,
  STAGING_REF,
} from "./supabase-project-refs.mjs";

const CLINIC_COUNT = Number(process.env.PHASE7B_CLINIC_COUNT || 5);
const PROFS_PER_CLINIC = Number(process.env.PHASE7B_PROFS_PER_CLINIC || 3);
const PATIENTS_PER_CLINIC = Number(process.env.PHASE7B_PATIENTS_PER_CLINIC || 60);
const MARKER = "LOADTEST_PHASE7B";

function fail(msg) {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

function clinicId(i) {
  return `e7b00000-0000-4000-8000-${String(i).padStart(12, "0")}`;
}

function profId(clinicIdx, profIdx) {
  const n = (clinicIdx - 1) * 10 + profIdx;
  return `e7b10000-0000-4000-8000-${String(n).padStart(12, "0")}`;
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

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const e2eEmail = (env.E2E_EMAIL || "").trim().toLowerCase();
if (!e2eEmail) fail("E2E_EMAIL required to attach a write-capable membership.");

const { data: listed, error: listError } = await admin.auth.admin.listUsers({
  page: 1,
  perPage: 200,
});
if (listError) fail(`listUsers failed: ${listError.message}`);
const e2eUser = listed?.users?.find((u) => u.email?.toLowerCase() === e2eEmail);
if (!e2eUser?.id) fail("E2E auth user not found — run configure-staging-e2e-account.mjs first.");

const clinics = [];
const professionals = [];
const patients = [];
const records = [];
const appointments = [];

console.log(`Seeding Phase 7B fixtures (${CLINIC_COUNT} clinics × ${PATIENTS_PER_CLINIC} patients)…`);

for (let c = 1; c <= CLINIC_COUNT; c++) {
  const id = clinicId(c);
  const name = `LOADTEST_CLINIC_${String(c).padStart(3, "0")}`;
  const slug = `loadtest-clinic-${String(c).padStart(3, "0")}`;

  const { error: clinicError } = await admin.from("clinics").upsert(
    {
      id,
      name,
      slug,
      email: `loadtest-clinic-${c}@staging.drflow.invalid`,
      phone: `555000${String(c).padStart(4, "0")}`,
      is_active: true,
    },
    { onConflict: "id" }
  );
  if (clinicError) fail(`clinic upsert ${name}: ${clinicError.message}`);
  clinics.push({ id, name, slug, index: c });

  const { error: memberError } = await admin.from("clinic_members").upsert(
    {
      clinic_id: id,
      user_id: e2eUser.id,
      role: "clinic_admin",
      is_active: true,
    },
    { onConflict: "clinic_id,user_id" }
  );
  if (memberError) fail(`clinic_members upsert: ${memberError.message}`);

  const clinicProfs = [];
  for (let p = 1; p <= PROFS_PER_CLINIC; p++) {
    const pid = profId(c, p);
    const display = `LOADTEST_PROFESSIONAL_${String(c).padStart(2, "0")}_${String(p).padStart(2, "0")}`;
    const { error: profError } = await admin.from("professionals").upsert(
      {
        id: pid,
        clinic_id: id,
        display_name: display,
        is_active: true,
        license_number: `LT-${c}-${p}`,
        bio: MARKER,
      },
      { onConflict: "id" }
    );
    if (profError) fail(`professional upsert: ${profError.message}`);
    clinicProfs.push({ id: pid, clinic_id: id, display_name: display });
    professionals.push({ id: pid, clinic_id: id, display_name: display });
  }

  for (let i = 1; i <= PATIENTS_PER_CLINIC; i++) {
    const doc = `9${String(c).padStart(2, "0")}${String(i).padStart(5, "0")}`;
    const first = "LOADTEST";
    const last = `PATIENT_${String(c).padStart(2, "0")}_${String(i).padStart(4, "0")}`;

    const { data: existing } = await admin
      .from("patients")
      .select("id")
      .eq("clinic_id", id)
      .eq("document_number", doc)
      .maybeSingle();

    let patientId = existing?.id ?? null;
    if (!patientId) {
      const { data: inserted, error } = await admin
        .from("patients")
        .insert({
          clinic_id: id,
          first_name: first,
          last_name: last,
          document_number: doc,
          phone: "0000000000",
          email: `loadtest.p${c}.${i}@staging.drflow.invalid`,
          notes: MARKER,
          is_active: true,
        })
        .select("id")
        .single();
      if (error || !inserted) fail(`patient insert: ${error?.message ?? "none"}`);
      patientId = inserted.id;
    } else {
      await admin
        .from("patients")
        .update({ first_name: first, last_name: last, notes: MARKER, is_active: true })
        .eq("id", patientId);
    }

    const professionalId = clinicProfs[(i - 1) % clinicProfs.length].id;
    patients.push({
      id: patientId,
      clinic_id: id,
      document_number: doc,
      professional_id: professionalId,
      label: `${first}_${last}`,
    });

    const { data: existingRec } = await admin
      .from("clinical_records")
      .select("id")
      .eq("clinic_id", id)
      .eq("patient_id", patientId)
      .eq("chief_complaint", "synthetic load test subject")
      .maybeSingle();

    let recordId = existingRec?.id ?? null;
    if (!recordId) {
      const { data: rec, error: recError } = await admin
        .from("clinical_records")
        .insert({
          clinic_id: id,
          patient_id: patientId,
          professional_id: professionalId,
          chief_complaint: "synthetic load test subject",
          diagnosis: "synthetic load test assessment",
          evolution: "synthetic load test objective",
          indications: "synthetic load test plan",
          created_by: e2eUser.id,
          updated_by: e2eUser.id,
        })
        .select("id")
        .single();
      if (recError || !rec) fail(`clinical_record insert: ${recError?.message ?? "none"}`);
      recordId = rec.id;
    }
    records.push({
      id: recordId,
      clinic_id: id,
      patient_id: patientId,
      professional_id: professionalId,
    });

    if (i <= 20) {
      const start = new Date(Date.now() + (c * 86400000 + i * 3600000));
      const end = new Date(start.getTime() + 30 * 60000);
      const { data: appt, error: apptError } = await admin
        .from("appointments")
        .insert({
          clinic_id: id,
          patient_id: patientId,
          professional_id: professionalId,
          start_at: start.toISOString(),
          end_at: end.toISOString(),
          status: "confirmed",
          notes: `${MARKER} appointment`,
          booking_source: "manual",
        })
        .select("id")
        .single();
      if (!apptError && appt) {
        appointments.push({
          id: appt.id,
          clinic_id: id,
          patient_id: patientId,
          professional_id: professionalId,
        });
      }
    }
  }
}

const manifest = {
  generatedAt: new Date().toISOString(),
  marker: MARKER,
  stagingRef: STAGING_REF,
  actorUserId: e2eUser.id,
  counts: {
    clinics: clinics.length,
    professionals: professionals.length,
    patients: patients.length,
    clinicalRecords: records.length,
    appointments: appointments.length,
  },
  clinics,
  professionals,
  patients,
  records,
  appointments,
  removableHint:
    "Delete clinics where name LIKE 'LOADTEST_CLINIC_%' (cascades patients/records) or filter notes/chief_complaint by LOADTEST_PHASE7B / synthetic load test.",
};

const outDir = resolve(process.cwd(), "coverage/load");
mkdirSync(outDir, { recursive: true });
const outPath = resolve(outDir, "clinical-write-fixtures.json");
writeFileSync(outPath, JSON.stringify(manifest, null, 2), "utf8");

const envLocal = [
  `PHASE7B_FIXTURES=${outPath.replace(/\\/g, "/")}`,
  `PHASE7B_CLINIC_COUNT=${clinics.length}`,
  `PHASE7B_RECORD_COUNT=${records.length}`,
].join("\n");
writeFileSync(resolve(process.cwd(), "e2e/.phase7b-env.local"), `${envLocal}\n`, "utf8");

console.log("Phase 7B fixtures ready.");
console.log(`  clinics:       ${clinics.length}`);
console.log(`  professionals: ${professionals.length}`);
console.log(`  patients:      ${patients.length}`);
console.log(`  records:       ${records.length}`);
console.log(`  appointments:  ${appointments.length}`);
console.log(`  manifest:      ${outPath}`);
console.log("  (no credentials written)");
