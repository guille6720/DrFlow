"use server";

import { revalidatePath } from "next/cache";

import { recordAudit, recordAuditChange } from "@/core/security/audit-service";
import { requireMedicalOrderAccess } from "@/core/services/clinical-access.service";
import { createClient } from "@/core/supabase/server";
import { parseEntityId } from "@/core/validations/params";

import {
  createMedicalOrderRecord,
  parseMedicalOrderForm,
  validateMedicalOrderInput,
  voidMedicalOrderRecord,
} from "@/features/recetas/services/medical-orders.service";

export async function createMedicalOrder(formData: FormData) {
  const access = await requireMedicalOrderAccess();
  if (!access.ok) return { error: access.error };
  const { userId, clinicId } = access.data;

  const input = parseMedicalOrderForm(formData);
  const validationError = validateMedicalOrderInput(input);
  if (validationError) return { error: validationError };

  const supabase = await createClient();
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

  revalidatePath("/historias");
  revalidatePath("/recetas");
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

  revalidatePath("/historias");
  revalidatePath("/recetas");
  return { success: true };
}
