import type { ElectronicPrescription } from "@/types/prescription";
import type { DbClient, RepoResult } from "@/lib/repositories/types";
import { mapDbError, repoErr, repoOk } from "@/lib/repositories/types";

export type PrescriptionDraftInsertRow = {
  clinic_id: string;
  patient_id: string;
  clinical_record_id: string | null;
  professional_id: string;
  prescription_type: string;
  diagnosis_cie10: string;
  diagnosis_text: string;
  patient_insurance: string | null;
  medications: unknown;
  notes: string | null;
  validity_days: number;
  disclaimer_accepted: boolean;
  status: string;
  refeps_status: string;
  created_by: string;
};

const PRESCRIPTION_DB_HINTS: Record<string, string> = {
  diagnosis_cie10:
    "Falta la migración de recetas en Supabase. Ejecutá en el SQL Editor el archivo supabase/migrations/014_repair_prescription_schema.sql (o 013) y volvé a intentar.",
  prescription_type:
    "Falta la migración de recetas en Supabase. Ejecutá en el SQL Editor el archivo supabase/migrations/014_repair_prescription_schema.sql (o 013) y volvé a intentar.",
  "schema cache":
    "Falta la migración de recetas en Supabase. Ejecutá en el SQL Editor el archivo supabase/migrations/014_repair_prescription_schema.sql (o 013) y volvé a intentar.",
};

export function formatPrescriptionDbError(message: string): string {
  return mapDbError(message, PRESCRIPTION_DB_HINTS);
}

export async function insertPrescriptionDraft(
  db: DbClient,
  row: PrescriptionDraftInsertRow
): Promise<RepoResult<ElectronicPrescription>> {
  const { data, error } = await db.from("prescription_drafts").insert(row).select().single();
  if (error) return repoErr(formatPrescriptionDbError(error.message));
  return repoOk(data as ElectronicPrescription);
}

export async function updatePrescriptionDraft(
  db: DbClient,
  draftId: string,
  clinicId: string,
  row: Partial<PrescriptionDraftInsertRow> & { updated_at: string }
): Promise<RepoResult<ElectronicPrescription>> {
  const { data, error } = await db
    .from("prescription_drafts")
    .update(row)
    .eq("id", draftId)
    .eq("clinic_id", clinicId)
    .eq("status", "draft")
    .select()
    .single();

  if (error) return repoErr(formatPrescriptionDbError(error.message));
  return repoOk(data as ElectronicPrescription);
}

export async function issuePrescriptionDraft(
  db: DbClient,
  draftId: string,
  clinicId: string
): Promise<RepoResult<ElectronicPrescription>> {
  const { data, error } = await db
    .from("prescription_drafts")
    .update({
      status: "issued",
      issued_at: new Date().toISOString(),
      refeps_status: "local",
      updated_at: new Date().toISOString(),
    })
    .eq("id", draftId)
    .eq("clinic_id", clinicId)
    .eq("status", "draft")
    .select()
    .single();

  if (error) return repoErr(formatPrescriptionDbError(error.message));
  return repoOk(data as ElectronicPrescription);
}

export async function voidPrescriptionDraft(
  db: DbClient,
  draftId: string,
  clinicId: string
): Promise<RepoResult<ElectronicPrescription>> {
  const { data, error } = await db
    .from("prescription_drafts")
    .update({
      status: "void",
      updated_at: new Date().toISOString(),
    })
    .eq("id", draftId)
    .eq("clinic_id", clinicId)
    .in("status", ["draft", "issued"])
    .select()
    .single();

  if (error) return repoErr(formatPrescriptionDbError(error.message));
  return repoOk(data as ElectronicPrescription);
}
