import type { DbClient } from "@/core/repositories/types";
import type { ServiceResult } from "@/core/services/types";
import { fromRepo, serviceErr, serviceOk } from "@/core/services/types";
import {
  type MedicalOrderFormInput,
  medicalOrderFormSchema,
} from "@/core/validations/medical-order";
import { firstZodIssue } from "@/core/validations/params";
import { sanitizeText } from "@/core/validations/schemas";

import {
  findMedicalOrderByIdempotencyKey,
  getMedicalOrderVersionRow,
  insertMedicalOrder,
  updateMedicalOrderRow,
  voidMedicalOrderRow,
} from "@/features/recetas/repositories/medical-orders.repository";
import { isMedicalOrderUniqueViolation } from "@/features/recetas/utils/medical-order-idempotency";

import type { MedicalOrder } from "@/types/medical-order";

export type MedicalOrderInput = MedicalOrderFormInput;

export type CreateMedicalOrderRecordResult =
  | { ok: true; data: MedicalOrder; created: boolean }
  | { ok: false; error: string };

export { normalizeMedicalOrderVersion, parseMedicalOrderExpectedVersion } from "@/features/recetas/utils/medical-order-version";

export function parseMedicalOrderForm(formData: FormData): MedicalOrderInput {
  const notesRaw = formData.get("notes");
  const notes =
    notesRaw == null || String(notesRaw).trim() === "" ? null : String(notesRaw);

  const idempotencyRaw = formData.get("idempotency_key");
  const idempotencyKey =
    idempotencyRaw == null || String(idempotencyRaw).trim() === ""
      ? null
      : String(idempotencyRaw).trim();

  return {
    patient_id: String(formData.get("patient_id") ?? ""),
    professional_id: String(formData.get("professional_id") ?? ""),
    order_text: String(formData.get("order_text") ?? ""),
    notes,
    clinical_record_id: String(formData.get("clinical_record_id") ?? "") || null,
    order_type: String(formData.get("order_type") ?? "study") as MedicalOrderFormInput["order_type"],
    idempotency_key: idempotencyKey,
  };
}

export function validateMedicalOrderInput(input: MedicalOrderInput): string | null {
  const result = parseValidatedMedicalOrderInput(input);
  return result.ok ? null : result.error;
}

/** Único punto de validación Zod para mutaciones de órdenes médicas. */
export function parseValidatedMedicalOrderInput(
  input: MedicalOrderInput
): ServiceResult<MedicalOrderFormInput> {
  const parsed = medicalOrderFormSchema.safeParse(input);
  if (!parsed.success) return serviceErr(firstZodIssue(parsed.error));

  const orderText = sanitizeText(parsed.data.order_text);
  const notes = parsed.data.notes?.trim()
    ? sanitizeText(parsed.data.notes.trim())
    : null;

  if (!orderText) {
    return serviceErr("La orden: campo obligatorio.");
  }

  return serviceOk({
    ...parsed.data,
    order_text: orderText,
    notes,
  });
}

export async function resolveMedicalOrderExpectedVersion(
  db: DbClient,
  orderId: string,
  clinicId: string,
  fromClient: number | null
): Promise<ServiceResult<number>> {
  if (fromClient != null) return fromRepo({ ok: true, data: fromClient });

  const current = await getMedicalOrderVersionRow(db, orderId, clinicId);
  if (!current.ok) return serviceErr(current.error);
  if (current.data.status !== "issued") {
    return serviceErr("La orden no existe o ya fue anulada.");
  }
  return fromRepo({ ok: true, data: current.data.version });
}

export async function createMedicalOrderRecord(
  db: DbClient,
  input: MedicalOrderInput & { clinicId: string; userId: string }
): Promise<CreateMedicalOrderRecordResult> {
  const validated = parseValidatedMedicalOrderInput(input);
  if (!validated.ok) return validated;

  const idempotencyKey = validated.data.idempotency_key ?? null;

  if (idempotencyKey) {
    const existing = await findMedicalOrderByIdempotencyKey(
      db,
      input.clinicId,
      idempotencyKey
    );
    if (!existing.ok) return existing;
    if (existing.data) {
      return { ok: true, data: existing.data, created: false };
    }
  }

  const result = await insertMedicalOrder(db, {
    clinic_id: input.clinicId,
    patient_id: validated.data.patient_id,
    professional_id: validated.data.professional_id,
    clinical_record_id: validated.data.clinical_record_id ?? null,
    order_text: validated.data.order_text,
    notes: validated.data.notes ?? null,
    order_type: validated.data.order_type,
    status: "issued",
    created_by: input.userId,
    idempotency_key: idempotencyKey,
  });

  if (!result.ok) {
    if (idempotencyKey && isMedicalOrderUniqueViolation(result.error)) {
      const replay = await findMedicalOrderByIdempotencyKey(
        db,
        input.clinicId,
        idempotencyKey
      );
      if (replay.ok && replay.data) {
        return { ok: true, data: replay.data, created: false };
      }
    }
    return result;
  }

  return { ok: true, data: result.data, created: true };
}

export async function updateMedicalOrderRecord(
  db: DbClient,
  orderId: string,
  clinicId: string,
  expectedVersion: number,
  input: MedicalOrderInput
): Promise<ServiceResult<MedicalOrder>> {
  const validated = parseValidatedMedicalOrderInput(input);
  if (!validated.ok) return validated;

  return fromRepo(
    await updateMedicalOrderRow(db, orderId, clinicId, expectedVersion, {
      order_text: validated.data.order_text,
      notes: validated.data.notes ?? null,
      order_type: validated.data.order_type,
      professional_id: validated.data.professional_id,
    })
  );
}

export async function voidMedicalOrderRecord(
  db: DbClient,
  orderId: string,
  clinicId: string,
  expectedVersion: number
): Promise<ServiceResult<void>> {
  return fromRepo(await voidMedicalOrderRow(db, orderId, clinicId, expectedVersion));
}
