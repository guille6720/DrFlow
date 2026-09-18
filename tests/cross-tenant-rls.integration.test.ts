import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";

function loadEnvFile(path: string): Record<string, string> {
  if (!existsSync(path)) return {};
  const env: Record<string, string> = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return env;
}

function resolveAnonKey(env: Record<string, string>): string {
  const publishable = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  const usable = (key?: string) =>
    Boolean(key) && !/placeholder|\[SENSITIVE\]/i.test(key!) && key!.length > 40;
  if (usable(publishable)) return publishable!;
  if (usable(anon)) return anon!;
  return publishable ?? anon ?? "";
}

const rootEnv = {
  ...loadEnvFile(resolve(process.cwd(), ".env.local")),
  ...process.env,
};
const phase3Env = loadEnvFile(resolve(process.cwd(), "e2e/.phase3-tenant-env.local"));

const url = rootEnv.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = resolveAnonKey(rootEnv);
const emailA = rootEnv.E2E_EMAIL?.trim();
const passwordA = rootEnv.E2E_PASSWORD?.trim();
const emailB = rootEnv.E2E_TENANT_B_EMAIL?.trim();
const passwordB = rootEnv.E2E_TENANT_B_PASSWORD?.trim();

const hasFixtures =
  !!phase3Env.PHASE3_CLINIC_A &&
  !!phase3Env.PHASE3_CLINIC_B &&
  !!phase3Env.PHASE3_PATIENT_A &&
  !!phase3Env.PHASE3_PATIENT_B &&
  !!phase3Env.PHASE3_RECORD_A &&
  !!phase3Env.PHASE3_RECORD_B;

const runIntegration =
  rootEnv.DRFLOW_RLS_INTEGRATION === "1" &&
  !!url &&
  !!anonKey &&
  !!emailA &&
  !!passwordA &&
  !!emailB &&
  !!passwordB &&
  hasFixtures &&
  !url.includes("placeholder") &&
  !url.includes("nipqdarduknydqptqzup");

async function signIn(email: string, password: string): Promise<SupabaseClient> {
  const client = createClient(url!, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    throw new Error(`Sign-in failed: ${error?.message ?? "no session"}`);
  }
  return client;
}

describe.skipIf(!runIntegration)("cross-tenant RLS (live JWT integration)", () => {
  it("User A reads own clinic patient but not Clinic B patient", async () => {
    const client = await signIn(emailA!, passwordA!);
    const patientA = phase3Env.PHASE3_PATIENT_A!;
    const patientB = phase3Env.PHASE3_PATIENT_B!;
    const clinicA = phase3Env.PHASE3_CLINIC_A!;

    const { data: rowA, error: errA } = await client
      .from("patients")
      .select("id, clinic_id")
      .eq("id", patientA)
      .maybeSingle();
    expect(errA).toBeNull();
    expect(rowA?.clinic_id).toBe(clinicA);

    const { data: rowB, error: errB } = await client
      .from("patients")
      .select("id, clinic_id")
      .eq("id", patientB)
      .maybeSingle();
    expect(errB).toBeNull();
    expect(rowB).toBeNull();
  });

  it("User A cannot read Clinic B clinical_record by id", async () => {
    const client = await signIn(emailA!, passwordA!);
    const recordB = phase3Env.PHASE3_RECORD_B!;

    const { data, error } = await client
      .from("clinical_records")
      .select("id, clinic_id, patient_id")
      .eq("id", recordB)
      .maybeSingle();

    expect(error).toBeNull();
    expect(data).toBeNull();
  });

  it("User A RPC update_clinical_record_atomic on Clinic B is denied", async () => {
    const client = await signIn(emailA!, passwordA!);
    const { data: userData } = await client.auth.getUser();
    const userId = userData.user!.id;

    const { error } = await client.rpc("update_clinical_record_atomic", {
      p_clinic_id: phase3Env.PHASE3_CLINIC_B,
      p_record_id: phase3Env.PHASE3_RECORD_B,
      p_patient_id: phase3Env.PHASE3_PATIENT_B,
      p_professional_id: null,
      p_appointment_id: null,
      p_chief_complaint: "cross-tenant vitest probe",
      p_diagnosis: "",
      p_evolution: "",
      p_indications: "",
      p_updated_by: userId,
    });

    expect(error).toBeTruthy();
    expect(String(error?.message ?? "")).toMatch(/FORBIDDEN|RECORD_NOT_FOUND|permission/i);
  });

  it("User A PATIENT_MISMATCH rejects same-clinic wrong patient_id without mutation", async () => {
    const sameClinicPatientB = phase3Env.PHASE3_SAME_CLINIC_PATIENT_B;
    if (!sameClinicPatientB) return;

    const client = await signIn(emailA!, passwordA!);
    const recordA = phase3Env.PHASE3_RECORD_A!;
    const { data: userData } = await client.auth.getUser();

    const { data: before } = await client
      .from("clinical_records")
      .select(
        "patient_id, clinic_id, professional_id, chief_complaint, diagnosis, evolution, indications, updated_at"
      )
      .eq("id", recordA)
      .single();

    const { error } = await client.rpc("update_clinical_record_atomic", {
      p_clinic_id: phase3Env.PHASE3_CLINIC_A,
      p_record_id: recordA,
      p_patient_id: sameClinicPatientB,
      p_professional_id: before.professional_id,
      p_appointment_id: null,
      p_chief_complaint: before.chief_complaint ?? "qa",
      p_diagnosis: before.diagnosis ?? "",
      p_evolution: before.evolution ?? "",
      p_indications: before.indications ?? "",
      p_updated_by: userData.user!.id,
    });

    expect(String(error?.message ?? "")).toMatch(/PATIENT_MISMATCH/i);

    const { data: after } = await client
      .from("clinical_records")
      .select("patient_id, chief_complaint, updated_at")
      .eq("id", recordA)
      .single();

    expect(after?.patient_id).toBe(before.patient_id);
    expect(after?.chief_complaint).toBe(before.chief_complaint);
    expect(after?.updated_at).toBe(before.updated_at);
  });

  it("User A cannot obtain signed URL for Clinic B storage path", async () => {
    const client = await signIn(emailA!, passwordA!);
    const path = phase3Env.PHASE3_ATTACHMENT_B_PATH!;

    const { data, error } = await client.storage.from("clinical-files").createSignedUrl(path, 60);
    expect(data?.signedUrl).toBeFalsy();
    expect(error ?? !data?.signedUrl).toBeTruthy();
  });

  it("User B inverse — cannot read Clinic A patient", async () => {
    const client = await signIn(emailB!, passwordB!);
    const patientA = phase3Env.PHASE3_PATIENT_A!;

    const { data, error } = await client
      .from("patients")
      .select("id")
      .eq("id", patientA)
      .maybeSingle();

    expect(error).toBeNull();
    expect(data).toBeNull();
  });
});
