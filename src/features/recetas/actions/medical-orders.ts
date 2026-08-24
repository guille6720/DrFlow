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
  updateMedicalOrderRecord,
  voidMedicalOrderRecord,
} from "@/features/recetas/services/medical-orders.service";
import { normalizeMedicalOrderVersion, parseMedicalOrderExpectedVersion } from "@/features/recetas/utils/medical-order-version";

import type { MedicalOrderStatus } from "@/types/medical-order";

const MEDICAL_ORDER_AUDIT_SELECT =
  "id, patient_id, clinical_record_id, professional_id, order_type, order_text, notes, status, version";

function isIssuedMedicalOrderStatus(status: string): status is Extract<MedicalOrderStatus, "issued"> {
  return status === "issued";
}

async function loadIssuedMedicalOrderForMutation(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clinicId: string,
  orderId: string
) {
  const { data: before } = await supabase
    .from("medical_orders")
    .select(MEDICAL_ORDER_AUDIT_SELECT)
    .eq("id", orderId)
    .eq("clinic_id", clinicId)
    .maybeSingle();

  if (!before || !isIssuedMedicalOrderStatus(before.status)) {
    return { ok: false as const, error: "La orden no existe o ya fue anulada." };
  }
  return {
    ok: true as const,
    data: {
      ...before,
      status: before.status,
    },
  };
}

export async function createMedicalOrder(formData: FormData) {
  const [access, supabase] = await Promise.all([requireMedicalOrderAccess(), createClient()]);
  if (!access.ok) return { error: access.error };
  const { userId, clinicId } = access.data;

  const input = parseMedicalOrderForm(formData);

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
  const [access, supabase] = await Promise.all([requireMedicalOrderAccess(), createClient()]);
  if (!access.ok) return { error: access.error };
  const { clinicId } = access.data;

  const idParsed = parseEntityId(id, "Orden");
  if (!idParsed.ok) return { error: idParsed.error };

  const input = parseMedicalOrderForm(formData);

  const [ownership, issued] = await Promise.all([
    verifyMedicalOrderForeignKeys(supabase, clinicId, {
      patientId: input.patient_id,
      professionalId: input.professional_id,
      clinicalRecordId: input.clinical_record_id,
    }),
    loadIssuedMedicalOrderForMutation(supabase, clinicId, idParsed.data),
  ]);
  if (!ownership.ok) return { error: ownership.error };
  if (!issued.ok) return { error: issued.error };

  const before = issued.data;
  const expectedVersion =
    parseMedicalOrderExpectedVersion(formData) ??
    normalizeMedicalOrderVersion(before.version);

  const result = await updateMedicalOrderRecord(
    supabase,
    idParsed.data,
    clinicId,
    expectedVersion,
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
  const [access, supabase] = await Promise.all([requireMedicalOrderAccess(), createClient()]);
  if (!access.ok) return { error: access.error };

  const idParsed = parseEntityId(id, "Orden");
  if (!idParsed.ok) return { error: idParsed.error };

  const issued = await loadIssuedMedicalOrderForMutation(
    supabase,
    access.data.clinicId,
    idParsed.data
  );
  if (!issued.ok) return { error: issued.error };

  const before = issued.data;
  const version =
    expectedVersion != null
      ? normalizeMedicalOrderVersion(expectedVersion)
      : normalizeMedicalOrderVersion(before.version);

  const result = await voidMedicalOrderRecord(
    supabase,
    idParsed.data,
    access.data.clinicId,
    version
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
