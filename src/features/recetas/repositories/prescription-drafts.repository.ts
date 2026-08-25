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
  coverage_kind?: string | null;
  insurance_number?: string | null;
  insurance_plan?: string | null;
  medications: unknown;
  notes: string | null;
  validity_days: number;
  disclaimer_accepted: boolean;
  status: string;
  refeps_status: string;
  created_by: string;
};

export const PRESCRIPTION_ISSUE_COLUMNS =
  "id, clinic_id, patient_id, clinical_record_id, professional_id, prescription_type, diagnosis_cie10, diagnosis_text, patient_insurance, coverage_kind, insurance_number, insurance_plan, medications, notes, validity_days, disclaimer_accepted, status, prescription_number, issued_at, dispensed_at, refeps_status, refeps_id, refeps_submitted_at, refeps_error, refeps_payload, digital_signature_hash, idempotency_key, version, created_by, created_at, updated_at, validity_starts_at, prescription_category, prescription_subtype, national_rx_status, cuir_status, cuir_platform_id, cuir_repository_id, cuir_jurisdiction, cuir_type_subtype, cuir_group_id, cuir_item_number, cuir_formatted, diagnosis_coding, fhir_bundle_meta";

export function formatPrescriptionDbError(error: {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
}): string {
  return mapPostgresError(error);
}

export async function insertPrescriptionDraft(
  db: DbClient,
  row: PrescriptionDraftInsertRow
): Promise<RepoResult<ElectronicPrescription>> {
  const { data, error } = await db.from("prescription_drafts").insert(row).select(PRESCRIPTION_ISSUE_COLUMNS).single();
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
    .select(PRESCRIPTION_ISSUE_COLUMNS)
    .single();

  if (error) return repoErr(formatPrescriptionDbError(error));
  return repoOk(data as ElectronicPrescription);
}

export async function getPrescriptionDraftForIssue(
  db: DbClient,
  draftId: string,
  clinicId: string
): Promise<RepoResult<ElectronicPrescription | null>> {
  const { data, error } = await db
    .from("prescription_drafts")
    .select(PRESCRIPTION_ISSUE_COLUMNS)
    .eq("id", draftId)
    .eq("clinic_id", clinicId)
    .maybeSingle();

  if (error) return repoErr(formatPrescriptionDbError(error));
  return repoOk((data as ElectronicPrescription | null) ?? null);
}

export async function findPrescriptionByIdempotencyKey(
  db: DbClient,
  clinicId: string,
  idempotencyKey: string
): Promise<RepoResult<ElectronicPrescription | null>> {
  const { data, error } = await db
    .from("prescription_drafts")
    .select(PRESCRIPTION_ISSUE_COLUMNS)
    .eq("clinic_id", clinicId)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();

  if (error) return repoErr(formatPrescriptionDbError(error));
  return repoOk((data as ElectronicPrescription | null) ?? null);
}

export async function issuePrescriptionDraft(
  db: DbClient,
  draftId: string,
  clinicId: string,
  patch?: {
    patient_insurance?: string | null;
    coverage_kind?: string | null;
    insurance_number?: string | null;
    insurance_plan?: string | null;
    idempotency_key?: string | null;
    refeps_status?: string;
  }
): Promise<RepoResult<ElectronicPrescription>> {
  const { data, error } = await db
    .from("prescription_drafts")
    .update({
      status: "issued",
      refeps_status: patch?.refeps_status ?? "local",
      ...patch,
    })
    .eq("id", draftId)
    .eq("clinic_id", clinicId)
    .eq("status", "draft")
    .select(PRESCRIPTION_ISSUE_COLUMNS)
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
    .select(PRESCRIPTION_ISSUE_COLUMNS)
    .single();

  if (error) return repoErr(formatPrescriptionDbError(error));
  return repoOk(data as ElectronicPrescription);
}

export async function markPrescriptionDispensed(
  db: DbClient,
  prescriptionId: string,
  clinicId: string
): Promise<RepoResult<ElectronicPrescription>> {
  const { data, error } = await db
    .from("prescription_drafts")
    .update({ dispensed_at: new Date().toISOString() })
    .eq("id", prescriptionId)
    .eq("clinic_id", clinicId)
    .eq("status", "issued")
    .is("dispensed_at", null)
    .select(PRESCRIPTION_ISSUE_COLUMNS)
    .single();

  if (error) return repoErr(formatPrescriptionDbError(error));
  return repoOk(data as ElectronicPrescription);
}

export async function updatePrescriptionRefepsState(
  db: DbClient,
  prescriptionId: string,
  clinicId: string,
  patch: {
    refeps_status?: string;
    refeps_id?: string | null;
    refeps_submitted_at?: string | null;
    refeps_error?: string | null;
    refeps_payload?: Record<string, unknown> | null;
    digital_signature_hash?: string | null;
    national_rx_status?: string;
    cuir_status?: string;
    cuir_platform_id?: string | null;
    cuir_repository_id?: string | null;
    cuir_jurisdiction?: string | null;
    cuir_type_subtype?: string | null;
    cuir_group_id?: string | null;
    cuir_item_number?: string | null;
    cuir_formatted?: string | null;
    prescription_category?: string;
    prescription_subtype?: string | null;
    diagnosis_coding?: Record<string, unknown> | null;
    fhir_bundle_meta?: Record<string, unknown> | null;
  }
): Promise<RepoResult<ElectronicPrescription>> {
  const { data, error } = await db
    .from("prescription_drafts")
    .update(patch)
    .eq("id", prescriptionId)
    .eq("clinic_id", clinicId)
    .eq("status", "issued")
    .select(PRESCRIPTION_ISSUE_COLUMNS)
    .single();

  if (error) return repoErr(formatPrescriptionDbError(error));
  return repoOk(data as ElectronicPrescription);
}
