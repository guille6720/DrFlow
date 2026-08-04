import type { Patient } from "@/types/database";
import type { DbClient, RepoResult } from "@/core/repositories/types";
import { mapDbError, repoErr, repoOk } from "@/core/repositories/types";

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

const PATIENT_DB_HINTS: Record<string, string> = {
  insurance_plan:
    "Falta actualizar la base de datos (columna insurance_plan). En Supabase → SQL Editor ejecutá supabase/migrations/041_patients_insurance_plan.sql y volvé a intentar.",
};

export function formatPatientDbError(message: string): string {
  return mapDbError(message, PATIENT_DB_HINTS);
}

export async function findPatientById(
  db: DbClient,
  patientId: string,
  clinicId: string
): Promise<Patient | null> {
  const { data } = await db
    .from("patients")
    .select("*")
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
  const { data, error } = await db.from("patients").insert(row).select().single();
  if (error) return repoErr(formatPatientDbError(error.message));
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

  if (error) return repoErr(formatPatientDbError(error.message));
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
