"use server";

import { revalidatePath } from "next/cache";

import { recordAudit, recordAuditChange } from "@/core/security/audit-service";
import { verifyMedicalOrderForeignKeys } from "@/core/security/ownership-guard";
import { requireMedicalOrderAccess } from "@/core/services/clinical-access.service";
import { createClient } from "@/core/supabase/server";
import { parseEntityId } from "@/core/validations/params";

import {
  createMedicalOrderRecord,
  parseMedicalOrderForm,
  updateMedicalOrderRecord,
  validateMedicalOrderInput,
  voidMedicalOrderRecord,
} from "@/features/recetas/services/medical-orders.service";

function revalidateMedicalOrderPaths() {
  revalidatePath("/historias");
  revalidatePath("/recetas");
  revalidatePath("/pacientes");
}

export async function createMedicalOrder(formData: FormData) {
  const access = await requireMedicalOrderAccess();
  if (!access.ok) return { error: access.error };
  const { userId, clinicId } = access.data;

  const input = parseMedicalOrderForm(formData);
  const validationError = validateMedicalOrderInput(input);
  if (validationError) return { error: validationError };

  const supabase = await createClient();
  const ownership = await verifyMedicalOrderForeignKeys(supabase, clinicId, {
    patientId: input.patient_id,
    professionalId: input.professional_id,
    clinicalRecordId: input.clinical_record_id,
  });
  if (!ownership.ok) return { error: ownership.error };

  const result = await createMedicalOrderRecord(supabase, {
    ...input,
    clinicId,
    userId,
  });

  if (!result.ok) return { error: result.error };

  await recordAudit({
    clinicId,
    module: "orders",
    entityType: "medical_order",
    entityId: result.data.id,
    patientId: input.patient_id,
    action: "create",
  });

  revalidateMedicalOrderPaths();
  return { data: result.data };
}

export async function updateMedicalOrder(id: string, formData: FormData) {
  const access = await requireMedicalOrderAccess();
  if (!access.ok) return { error: access.error };
  const { clinicId } = access.data;

  const idParsed = parseEntityId(id, "Orden");
  if (!idParsed.ok) return { error: idParsed.error };

  const input = parseMedicalOrderForm(formData);
  const validationError = validateMedicalOrderInput(input);
  if (validationError) return { error: validationError };

  const supabase = await createClient();
  const ownership = await verifyMedicalOrderForeignKeys(supabase, clinicId, {
    patientId: input.patient_id,
    professionalId: input.professional_id,
    clinicalRecordId: input.clinical_record_id,
  });
  if (!ownership.ok) return { error: ownership.error };

  const { data: before } = await supabase
    .from("medical_orders")
    .select("id, patient_id, order_text, notes, order_type, professional_id, status")
    .eq("id", idParsed.data)
    .eq("clinic_id", clinicId)
    .maybeSingle();

  if (!before || before.status !== "issued") {
    return { error: "La orden no existe o ya fue anulada." };
  }

  const result = await updateMedicalOrderRecord(supabase, idParsed.data, clinicId, input);
  if (!result.ok) return { error: result.error };

  await recordAuditChange({
    clinicId,
    module: "orders",
    entityType: "medical_order",
    entityId: idParsed.data,
    patientId: before.patient_id,
    action: "update",
    before: {
      order_text: before.order_text,
      notes: before.notes,
      order_type: before.order_type,
      professional_id: before.professional_id,
    },
    after: {
      order_text: result.data.order_text,
      notes: result.data.notes,
      order_type: result.data.order_type,
      professional_id: result.data.professional_id,
    },
    keys: ["order_text", "notes", "order_type", "professional_id"],
  });

  revalidateMedicalOrderPaths();
  return { data: result.data };
}

export async function voidMedicalOrder(id: string) {
  const access = await requireMedicalOrderAccess();
  if (!access.ok) return { error: access.error };

  const idParsed = parseEntityId(id, "Orden");
  if (!idParsed.ok) return { error: idParsed.error };

  const supabase = await createClient();
  const { data: before } = await supabase
    .from("medical_orders")
    .select("id, patient_id, status")
    .eq("id", idParsed.data)
    .eq("clinic_id", access.data.clinicId)
    .maybeSingle();

  const result = await voidMedicalOrderRecord(supabase, idParsed.data, access.data.clinicId);
  if (!result.ok) return { error: result.error };

  await recordAuditChange({
    clinicId: access.data.clinicId,
    module: "orders",
    entityType: "medical_order",
    entityId: idParsed.data,
    patientId: before?.patient_id ?? undefined,
    action: "delete",
    before: before ? { status: before.status } : null,
    after: { status: "voided" },
    keys: ["status"],
  });

  revalidateMedicalOrderPaths();
  return { success: true };
}
