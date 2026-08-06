import type { DbClient } from "@/core/repositories/types";
import type { ServiceResult } from "@/core/services/types";
import { fromRepo, serviceErr } from "@/core/services/types";
import {
  type MedicalOrderFormInput,
  medicalOrderFormSchema,
} from "@/core/validations/medical-order";
import { firstZodIssue } from "@/core/validations/params";
import { sanitizeText } from "@/core/validations/schemas";

import {
  insertMedicalOrder,
  updateMedicalOrderRow,
  voidMedicalOrderRow,
} from "@/features/recetas/repositories/medical-orders.repository";

import type { MedicalOrder } from "@/types/medical-order";

export type MedicalOrderInput = MedicalOrderFormInput;

export function parseMedicalOrderForm(formData: FormData): MedicalOrderInput {
  const notes = String(formData.get("notes") ?? "").trim();
  return {
    patient_id: String(formData.get("patient_id") ?? ""),
    professional_id: String(formData.get("professional_id") ?? ""),
    order_text: sanitizeText(String(formData.get("order_text") ?? "")),
    notes: notes ? sanitizeText(notes) : null,
    clinical_record_id: String(formData.get("clinical_record_id") ?? "") || null,
    order_type: String(formData.get("order_type") ?? "study"),
  };
}

export function validateMedicalOrderInput(input: MedicalOrderInput): string | null {
  const parsed = medicalOrderFormSchema.safeParse(input);
  if (!parsed.success) return firstZodIssue(parsed.error);
  return null;
}

export async function createMedicalOrderRecord(
  db: DbClient,
  input: MedicalOrderInput & { clinicId: string; userId: string }
): Promise<ServiceResult<MedicalOrder>> {
  const validationError = validateMedicalOrderInput(input);
  if (validationError) return serviceErr(validationError);

  const parsed = medicalOrderFormSchema.parse(input);

  const result = await insertMedicalOrder(db, {
    clinic_id: input.clinicId,
    patient_id: parsed.patient_id,
    professional_id: parsed.professional_id,
    clinical_record_id: parsed.clinical_record_id ?? null,
    order_text: parsed.order_text,
    notes: parsed.notes ?? null,
    order_type: parsed.order_type,
    status: "issued",
    issued_at: new Date().toISOString(),
    created_by: input.userId,
  });

  return fromRepo(result);
}

export async function updateMedicalOrderRecord(
  db: DbClient,
  orderId: string,
  clinicId: string,
  input: MedicalOrderInput
): Promise<ServiceResult<MedicalOrder>> {
  const validationError = validateMedicalOrderInput(input);
  if (validationError) return serviceErr(validationError);

  const parsed = medicalOrderFormSchema.parse(input);

  return fromRepo(
    await updateMedicalOrderRow(db, orderId, clinicId, {
      order_text: parsed.order_text,
      notes: parsed.notes ?? null,
      order_type: parsed.order_type,
      professional_id: parsed.professional_id,
    })
  );
}

export async function voidMedicalOrderRecord(
  db: DbClient,
  orderId: string,
  clinicId: string
): Promise<ServiceResult<void>> {
  return fromRepo(await voidMedicalOrderRow(db, orderId, clinicId));
}
