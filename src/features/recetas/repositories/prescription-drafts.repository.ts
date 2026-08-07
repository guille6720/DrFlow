import type { DbClient, RepoResult } from "@/core/repositories/types";
import { mapPostgresError, repoErr, repoOk } from "@/core/repositories/types";

import type { ElectronicPrescription } from "@/types/prescription";

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

export function formatPrescriptionDbError(error: { message?: string; code?: string; details?: string; hint?: string }): string {
  return mapPostgresError(error);
}

export async function insertPrescriptionDraft(
  db: DbClient,
  row: PrescriptionDraftInsertRow
): Promise<RepoResult<ElectronicPrescription>> {
  const { data, error } = await db.from("prescription_drafts").insert(row).select().single();
  if (error) return repoErr(formatPrescriptionDbError(error));
  return repoOk(data as ElectronicPrescription);
}

export async function updatePrescriptionDraft(
  db: DbClient,
  draftId: string,
  clinicId: string,
  row: Partial<PrescriptionDraftInsertRow>
): Promise<RepoResult<ElectronicPrescription>> {
  const { data, error } = await db
    .from("prescription_drafts")
    .update(row)
    .eq("id", draftId)
    .eq("clinic_id", clinicId)
    .eq("status", "draft")
    .select()
    .single();

  if (error) return repoErr(formatPrescriptionDbError(error));
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
      refeps_status: "local",
    })
    .eq("id", draftId)
    .eq("clinic_id", clinicId)
    .eq("status", "draft")
    .select()
    .single();

  if (error) return repoErr(formatPrescriptionDbError(error));
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
    })
    .eq("id", draftId)
    .eq("clinic_id", clinicId)
    .in("status", ["draft", "issued"])
    .select()
    .single();

  if (error) return repoErr(formatPrescriptionDbError(error));
  return repoOk(data as ElectronicPrescription);
}
