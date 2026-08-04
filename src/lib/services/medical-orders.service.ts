import type { MedicalOrder } from "@/types/medical-order";
import type { DbClient } from "@/lib/repositories/types";
import {
  insertMedicalOrder,
  voidMedicalOrderRow,
} from "@/lib/repositories/medical-orders.repository";
import type { ServiceResult } from "@/lib/services/types";
import { fromRepo, serviceErr } from "@/lib/services/types";
import { sanitizeText } from "@/lib/validations/schemas";

export type MedicalOrderInput = {
  patientId: string;
  professionalId: string;
  orderText: string;
  notes: string | null;
  clinicalRecordId: string | null;
  orderType: string;
};

export function parseMedicalOrderForm(formData: FormData): MedicalOrderInput {
  const notes = String(formData.get("notes") ?? "").trim();
  return {
    patientId: String(formData.get("patient_id") ?? ""),
    professionalId: String(formData.get("professional_id") ?? ""),
    orderText: sanitizeText(String(formData.get("order_text") ?? "")),
    notes: notes ? sanitizeText(notes) : null,
    clinicalRecordId: String(formData.get("clinical_record_id") ?? "") || null,
    orderType: String(formData.get("order_type") ?? "study"),
  };
}

export function validateMedicalOrderInput(input: MedicalOrderInput): string | null {
  if (!input.patientId || !input.professionalId || !input.orderText) {
    return "Paciente, profesional y orden son obligatorios.";
  }
  return null;
}

export async function createMedicalOrderRecord(
  db: DbClient,
  input: MedicalOrderInput & { clinicId: string; userId: string }
): Promise<ServiceResult<MedicalOrder>> {
  const validationError = validateMedicalOrderInput(input);
  if (validationError) return serviceErr(validationError);

  const result = await insertMedicalOrder(db, {
    clinic_id: input.clinicId,
    patient_id: input.patientId,
    professional_id: input.professionalId,
    clinical_record_id: input.clinicalRecordId,
    order_text: input.orderText,
    notes: input.notes,
    order_type: input.orderType,
    status: "issued",
    issued_at: new Date().toISOString(),
    created_by: input.userId,
  });

  return fromRepo(result);
}

export async function voidMedicalOrderRecord(
  db: DbClient,
  orderId: string,
  clinicId: string
): Promise<ServiceResult<void>> {
  return fromRepo(await voidMedicalOrderRow(db, orderId, clinicId));
}
