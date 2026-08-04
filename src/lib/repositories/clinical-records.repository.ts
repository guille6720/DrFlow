import type { DbClient, RepoResult } from "@/lib/repositories/types";
import { repoErr, repoOk } from "@/lib/repositories/types";

export type ClinicalRecordInsertRow = {
  clinic_id: string;
  patient_id: string;
  professional_id: string;
  appointment_id: string | null;
  chief_complaint: string;
  diagnosis: string;
  evolution: string;
  indications: string;
  created_by: string;
};

export type ClinicalRecordUpdateRow = Omit<
  ClinicalRecordInsertRow,
  "clinic_id" | "created_by"
> & {
  updated_by: string;
  updated_at: string;
};

export async function findClinicalRecordById(
  db: DbClient,
  recordId: string,
  clinicId: string
): Promise<Record<string, unknown> | null> {
  const { data } = await db
    .from("clinical_records")
    .select("*")
    .eq("id", recordId)
    .eq("clinic_id", clinicId)
    .maybeSingle();

  return data;
}

export async function insertClinicalRecord(
  db: DbClient,
  row: ClinicalRecordInsertRow
): Promise<RepoResult<Record<string, unknown>>> {
  const { data, error } = await db.from("clinical_records").insert(row).select().single();
  if (error) return repoErr(error.message);
  return repoOk(data as Record<string, unknown>);
}

export async function updateClinicalRecordRow(
  db: DbClient,
  recordId: string,
  clinicId: string,
  row: ClinicalRecordUpdateRow
): Promise<RepoResult<Record<string, unknown>>> {
  const { data, error } = await db
    .from("clinical_records")
    .update(row)
    .eq("id", recordId)
    .eq("clinic_id", clinicId)
    .select()
    .single();

  if (error) return repoErr(error.message);
  return repoOk(data as Record<string, unknown>);
}

export async function insertClinicalRecordAuditRow(
  db: DbClient,
  row: Record<string, unknown>
): Promise<RepoResult<void>> {
  const { error } = await db.from("clinical_record_audit").insert(row);
  if (error) return repoErr(error.message);
  return repoOk(undefined);
}
