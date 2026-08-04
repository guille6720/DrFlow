import type { ElectronicPrescription } from "@/types/prescription";
import type { DbClient } from "@/core/repositories/types";
import {
  insertPrescriptionDraft,
  issuePrescriptionDraft,
  updatePrescriptionDraft,
  voidPrescriptionDraft,
  type PrescriptionDraftInsertRow,
} from "@/features/recetas/repositories/prescription-drafts.repository";
import type { ServiceResult } from "@/core/services/types";
import { fromRepo } from "@/core/services/types";
import { sanitizeText, prescriptionDraftSchema } from "@/core/validations/schemas";
import type { z } from "zod";

type PrescriptionDraftInput = z.infer<typeof prescriptionDraftSchema>;

export function parseMedicationsJson(raw: unknown): unknown {
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  return raw;
}

export function buildPrescriptionPayload(formData: FormData) {
  const medicationsRaw = formData.get("medications_json");
  const medications = parseMedicationsJson(medicationsRaw);

  return {
    patient_id: String(formData.get("patient_id") ?? ""),
    clinical_record_id: String(formData.get("clinical_record_id") ?? "") || null,
    professional_id: String(formData.get("professional_id") ?? ""),
    prescription_type: String(formData.get("prescription_type") ?? "ambulatoria"),
    diagnosis_cie10: String(formData.get("diagnosis_cie10") ?? ""),
    diagnosis_text: String(formData.get("diagnosis_text") ?? ""),
    patient_insurance: String(formData.get("patient_insurance") ?? "") || undefined,
    medications,
    notes: String(formData.get("notes") ?? "") || undefined,
    validity_days: Number(formData.get("validity_days") ?? 30),
    disclaimer_accepted:
      formData.get("disclaimer_accepted") === "on" ||
      formData.get("disclaimer_accepted") === "true",
  };
}

function buildDraftRow(
  clinicId: string,
  userId: string,
  parsed: PrescriptionDraftInput
): PrescriptionDraftInsertRow {
  return {
    clinic_id: clinicId,
    patient_id: parsed.patient_id,
    clinical_record_id: parsed.clinical_record_id ?? null,
    professional_id: parsed.professional_id,
    prescription_type: parsed.prescription_type,
    diagnosis_cie10: sanitizeText(parsed.diagnosis_cie10),
    diagnosis_text: sanitizeText(parsed.diagnosis_text),
    patient_insurance: parsed.patient_insurance ? sanitizeText(parsed.patient_insurance) : null,
    medications: parsed.medications,
    notes: parsed.notes ? sanitizeText(parsed.notes) : null,
    validity_days: parsed.validity_days,
    disclaimer_accepted: true,
    status: "draft",
    refeps_status: "local",
    created_by: userId,
  };
}

export async function savePrescriptionDraftRecord(
  db: DbClient,
  input: {
    clinicId: string;
    userId: string;
    parsed: PrescriptionDraftInput;
    existingDraftId: string | null;
  }
): Promise<ServiceResult<ElectronicPrescription>> {
  const row = buildDraftRow(input.clinicId, input.userId, input.parsed);

  if (input.existingDraftId) {
    const result = await updatePrescriptionDraft(db, input.existingDraftId, input.clinicId, {
      ...row,
      updated_at: new Date().toISOString(),
    });
    return fromRepo(result);
  }

  const result = await insertPrescriptionDraft(db, row);
  return fromRepo(result);
}

export async function issuePrescriptionRecord(
  db: DbClient,
  draftId: string,
  clinicId: string
): Promise<ServiceResult<ElectronicPrescription>> {
  return fromRepo(await issuePrescriptionDraft(db, draftId, clinicId));
}

export async function voidPrescriptionRecord(
  db: DbClient,
  draftId: string,
  clinicId: string
): Promise<ServiceResult<ElectronicPrescription>> {
  return fromRepo(await voidPrescriptionDraft(db, draftId, clinicId));
}
