"use server";

import { revalidateMedicalOrderSurfaces } from "@/core/cache/revalidate-medical-order-surfaces";
import { verifyMedicalOrderForeignKeys } from "@/core/security/ownership-guard";
import { requireMedicalOrderAccess } from "@/core/services/clinical-access.service";
import { createClient } from "@/core/supabase/server";
import { parseEntityId } from "@/core/validations/params";

import {
  recordMedicalOrderCreateAudit,
  recordMedicalOrderUpdateAudit,
  recordMedicalOrderVoidAudit,
} from "@/features/recetas/services/medical-order-audit";
import {
  createMedicalOrderRecord,
  parseMedicalOrderForm,
  resolveMedicalOrderExpectedVersion,
  updateMedicalOrderRecord,
  voidMedicalOrderRecord,
} from "@/features/recetas/services/medical-orders.service";
import { normalizeMedicalOrderVersion, parseMedicalOrderExpectedVersion } from "@/features/recetas/utils/medical-order-version";

const MEDICAL_ORDER_AUDIT_SELECT =
  "id, patient_id, clinical_record_id, professional_id, order_type, order_text, notes, status, version";

export async function createMedicalOrder(formData: FormData) {
  const access = await requireMedicalOrderAccess();
  if (!access.ok) return { error: access.error };
  const { userId, clinicId } = access.data;

  const input = parseMedicalOrderForm(formData);

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

  if (result.created) {
    await recordMedicalOrderCreateAudit({
      clinicId,
      entityId: result.data.id,
      patientId: result.data.patient_id,
      order: result.data,
    });
  }

  revalidateMedicalOrderSurfaces({
    patientId: result.data.patient_id,
    clinicalRecordId: result.data.clinical_record_id,
  });
  return { data: result.data };
}

export async function updateMedicalOrder(id: string, formData: FormData) {
  const access = await requireMedicalOrderAccess();
  if (!access.ok) return { error: access.error };
  const { clinicId } = access.data;

  const idParsed = parseEntityId(id, "Orden");
  if (!idParsed.ok) return { error: idParsed.error };

  const input = parseMedicalOrderForm(formData);

  const supabase = await createClient();
  const ownership = await verifyMedicalOrderForeignKeys(supabase, clinicId, {
    patientId: input.patient_id,
    professionalId: input.professional_id,
    clinicalRecordId: input.clinical_record_id,
  });
  if (!ownership.ok) return { error: ownership.error };

  const versionResult = await resolveMedicalOrderExpectedVersion(
    supabase,
    idParsed.data,
    clinicId,
    parseMedicalOrderExpectedVersion(formData)
  );
  if (!versionResult.ok) return { error: versionResult.error };

  const { data: before } = await supabase
    .from("medical_orders")
    .select(MEDICAL_ORDER_AUDIT_SELECT)
    .eq("id", idParsed.data)
    .eq("clinic_id", clinicId)
    .maybeSingle();

  if (!before || before.status !== "issued") {
    return { error: "La orden no existe o ya fue anulada." };
  }

  const result = await updateMedicalOrderRecord(
    supabase,
    idParsed.data,
    clinicId,
    versionResult.data,
    input
  );
  if (!result.ok) return { error: result.error };

  await recordMedicalOrderUpdateAudit({
    clinicId,
    entityId: idParsed.data,
    patientId: before.patient_id,
    before,
    after: result.data,
  });

  revalidateMedicalOrderSurfaces({
    patientId: result.data.patient_id,
    previousPatientId: before.patient_id,
    clinicalRecordId: result.data.clinical_record_id,
    previousClinicalRecordId: before.clinical_record_id,
  });
  return { data: result.data };
}

export async function voidMedicalOrder(id: string, expectedVersion?: number) {
  const access = await requireMedicalOrderAccess();
  if (!access.ok) return { error: access.error };

  const idParsed = parseEntityId(id, "Orden");
  if (!idParsed.ok) return { error: idParsed.error };

  const supabase = await createClient();
  const versionResult = await resolveMedicalOrderExpectedVersion(
    supabase,
    idParsed.data,
    access.data.clinicId,
    expectedVersion != null ? normalizeMedicalOrderVersion(expectedVersion) : null
  );
  if (!versionResult.ok) return { error: versionResult.error };

  const { data: before } = await supabase
    .from("medical_orders")
    .select(MEDICAL_ORDER_AUDIT_SELECT)
    .eq("id", idParsed.data)
    .eq("clinic_id", access.data.clinicId)
    .maybeSingle();

  if (!before || before.status !== "issued") {
    return { error: "La orden no existe o ya fue anulada." };
  }

  const result = await voidMedicalOrderRecord(
    supabase,
    idParsed.data,
    access.data.clinicId,
    versionResult.data
  );
  if (!result.ok) return { error: result.error };

  await recordMedicalOrderVoidAudit({
    clinicId: access.data.clinicId,
    entityId: idParsed.data,
    patientId: before.patient_id,
    before,
  });

  revalidateMedicalOrderSurfaces({
    patientId: before.patient_id,
    clinicalRecordId: before.clinical_record_id,
  });
  return { success: true };
}
