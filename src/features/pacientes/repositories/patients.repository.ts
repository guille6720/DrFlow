import type { DbClient, RepoResult } from "@/core/repositories/types";
import { mapPostgresError, repoErr, repoOk } from "@/core/repositories/types";
import { PATIENT_DETAIL_COLUMNS } from "@/core/supabase/select-columns";

import type { Patient } from "@/types/database";

export type PatientInsertRow = {
  clinic_id: string;
  first_name: string;
  last_name: string;
  document_number: string;
  birth_date: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  insurance_provider: string | null;
  insurance_plan: string | null;
  insurance_number: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
};

export type PatientUpdateRow = Omit<PatientInsertRow, "clinic_id">;

export function formatPatientDbError(error: { message?: string; code?: string; details?: string; hint?: string }): string {
  return mapPostgresError(error);
}

export async function findPatientById(
  db: DbClient,
  patientId: string,
  clinicId: string
): Promise<Patient | null> {
  const { data } = await db
    .from("patients")
    .select(PATIENT_DETAIL_COLUMNS)
    .eq("id", patientId)
    .eq("clinic_id", clinicId)
    .maybeSingle();

  return data as Patient | null;
}

export async function patientExists(
  db: DbClient,
  patientId: string,
  clinicId: string
): Promise<boolean> {
  const { data } = await db
    .from("patients")
    .select("id")
    .eq("id", patientId)
    .eq("clinic_id", clinicId)
    .maybeSingle();

  return Boolean(data);
}

export async function insertPatient(
  db: DbClient,
  row: PatientInsertRow
): Promise<RepoResult<Patient>> {
  const { data, error } = await db.from("patients").insert(row).select(PATIENT_DETAIL_COLUMNS).single();
  if (error) return repoErr(formatPatientDbError(error));
  return repoOk(data as Patient);
}

export async function updatePatientRow(
  db: DbClient,
  patientId: string,
  clinicId: string,
  row: Partial<PatientUpdateRow>
): Promise<RepoResult<void>> {
  const { error } = await db
    .from("patients")
    .update(row)
    .eq("id", patientId)
    .eq("clinic_id", clinicId);

  if (error) return repoErr(formatPatientDbError(error));
  return repoOk(undefined);
}

export async function findPatientForImportMerge(
  db: DbClient,
  patientId: string,
  clinicId: string
): Promise<{
  phone: string | null;
  email: string | null;
  insurance_provider: string | null;
  insurance_number: string | null;
  birth_date: string | null;
} | null> {
  const { data } = await db
    .from("patients")
    .select("phone, email, insurance_provider, insurance_number, birth_date")
    .eq("id", patientId)
    .eq("clinic_id", clinicId)
    .single();

  return data;
}
