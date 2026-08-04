import type { DbClient, RepoResult } from "@/core/repositories/types";
import { repoErr, repoOk } from "@/core/repositories/types";

export type PatientClinicalProfileFields = {
  medical_history: string | null;
  allergies: string | null;
  regular_medication: string | null;
  notes: string | null;
};

export type PatientClinicalProfileRow = PatientClinicalProfileFields & {
  patient_id: string;
};

export async function findPatientClinicalProfile(
  db: DbClient,
  patientId: string,
  clinicId: string
): Promise<PatientClinicalProfileFields | null> {
  const { data } = await db
    .from("patient_clinical_profiles")
    .select("medical_history, allergies, regular_medication, notes")
    .eq("patient_id", patientId)
    .eq("clinic_id", clinicId)
    .maybeSingle();

  return data;
}

export async function findPatientClinicalProfilesByIds(
  db: DbClient,
  clinicId: string,
  patientIds: string[]
): Promise<Map<string, PatientClinicalProfileFields>> {
  if (patientIds.length === 0) return new Map();

  const { data } = await db
    .from("patient_clinical_profiles")
    .select("patient_id, medical_history, allergies, regular_medication, notes")
    .eq("clinic_id", clinicId)
    .in("patient_id", patientIds);

  const map = new Map<string, PatientClinicalProfileFields>();
  for (const row of data ?? []) {
    map.set(row.patient_id, {
      medical_history: row.medical_history,
      allergies: row.allergies,
      regular_medication: row.regular_medication,
      notes: row.notes,
    });
  }
  return map;
}

export async function upsertPatientClinicalProfileRow(
  db: DbClient,
  patientId: string,
  clinicId: string,
  fields: Partial<PatientClinicalProfileFields>
): Promise<RepoResult<void>> {
  const payload = {
    patient_id: patientId,
    clinic_id: clinicId,
    medical_history: fields.medical_history ?? null,
    allergies: fields.allergies ?? null,
    regular_medication: fields.regular_medication ?? null,
    notes: fields.notes ?? null,
    updated_at: new Date().toISOString(),
  };

  const { error } = await db
    .from("patient_clinical_profiles")
    .upsert(payload, { onConflict: "patient_id" });

  if (error) return repoErr(error.message);
  return repoOk(undefined);
}

export function mergePatientClinicalFields<T extends object>(
  patient: T,
  profile: PatientClinicalProfileFields | null | undefined
): T & PatientClinicalProfileFields {
  return {
    ...patient,
    medical_history: profile?.medical_history ?? null,
    allergies: profile?.allergies ?? null,
    regular_medication: profile?.regular_medication ?? null,
    notes: profile?.notes ?? null,
  };
}

export function extractClinicalProfileFields(
  data: Partial<PatientClinicalProfileFields>
): PatientClinicalProfileFields {
  return {
    medical_history: data.medical_history ?? null,
    allergies: data.allergies ?? null,
    regular_medication: data.regular_medication ?? null,
    notes: data.notes ?? null,
  };
}
