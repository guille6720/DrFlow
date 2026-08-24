"use server";

import { logAudit } from "@/core/auth/session.actions";
import { revalidatePrescriptionSurfaces } from "@/core/cache/revalidate-prescription-surfaces";
import { recordAudit } from "@/core/security/audit-service";
import { verifyPrescriptionForeignKeys } from "@/core/security/ownership-guard";
import { requireClinicalIssueAccess } from "@/core/services/clinical-access.service";
import { createClient } from "@/core/supabase/server";
import { firstZodIssue, optionalEntityIdSchema, parseEntityId } from "@/core/validations/params";
import { prescriptionDraftSchema } from "@/core/validations/schemas";

import {
  buildPrescriptionPayload,
  issuePrescriptionRecord,
  markPrescriptionDispensedRecord,
  savePrescriptionDraftRecord,
  voidPrescriptionRecord,
} from "@/features/recetas/services/prescriptions.service";

export async function savePrescriptionDraft(formData: FormData) {
  const [access, supabase] = await Promise.all([requireClinicalIssueAccess(), createClient()]);
  if (!access.ok) return { error: access.error };
  const { userId, clinicId } = access.data;

  const parsed = prescriptionDraftSchema.safeParse(buildPrescriptionPayload(formData));
  if (!parsed.success) return { error: firstZodIssue(parsed.error) };

  const rawId = formData.get("id");
  const existingParsed = optionalEntityIdSchema.safeParse(
    typeof rawId === "string" && rawId.trim() ? rawId.trim() : null
  );
  if (!existingParsed.success) return { error: "Borrador inválido" };

  const ownership = await verifyPrescriptionForeignKeys(supabase, clinicId, {
    patientId: parsed.data.patient_id,
    professionalId: parsed.data.professional_id,
    clinicalRecordId: parsed.data.clinical_record_id,
  });
  if (!ownership.ok) return { error: ownership.error };

  const result = await savePrescriptionDraftRecord(supabase, {
    clinicId,
    userId,
    parsed: parsed.data,
    existingDraftId: existingParsed.data ?? null,
  });

  if (!result.ok) return { error: result.error };

  if (!existingParsed.data) {
    await logAudit({
      clinicId,
      module: "prescriptions",
      what: "Guardó borrador de receta",
      entityType: "prescription",
      entityId: result.data.id,
      patientId: parsed.data.patient_id,
      action: "create",
    });
  }

  revalidatePrescriptionSurfaces({
    patientId: parsed.data.patient_id,
    clinicalRecordId: parsed.data.clinical_record_id,
  });
  return { data: result.data };
}

export async function issuePrescription(id: string, idempotencyKey?: string | null) {
  const [access, supabase] = await Promise.all([requireClinicalIssueAccess(), createClient()]);
  if (!access.ok) return { error: access.error };

  const idParsed = parseEntityId(id, "Receta");
  if (!idParsed.ok) return { error: idParsed.error };
  const result = await issuePrescriptionRecord(
    supabase,
    idParsed.data,
    access.data.clinicId,
    access.data.userId,
    idempotencyKey
  );
  if (!result.ok) return { error: result.error };

  if (result.created) {
    await recordAudit({
      clinicId: access.data.clinicId,
      module: "prescriptions",
      entityType: "prescription",
      entityId: idParsed.data,
      patientId: result.data.patient_id,
      action: "update",
      what: "Emitió receta local (borrador — sin homologación REFEPS)",
      metadata: {
        status: "issued",
        coverage_kind: result.data.coverage_kind,
        prescription_number: result.data.prescription_number,
        legal_validity: "local_draft_only",
      },
    });
  }

  revalidatePrescriptionSurfaces({
    patientId: result.data.patient_id,
    clinicalRecordId: result.data.clinical_record_id,
  });
  return { data: result.data };
}

export async function voidPrescription(id: string) {
  const [access, supabase] = await Promise.all([requireClinicalIssueAccess(), createClient()]);
  if (!access.ok) return { error: access.error };

  const idParsed = parseEntityId(id, "Receta");
  if (!idParsed.ok) return { error: idParsed.error };
  const result = await voidPrescriptionRecord(
    supabase,
    idParsed.data,
    access.data.clinicId,
    access.data.userId
  );
  if (!result.ok) return { error: result.error };

  await recordAudit({
    clinicId: access.data.clinicId,
    module: "prescriptions",
    entityType: "prescription",
    entityId: idParsed.data,
    patientId: result.data.patient_id,
    action: "delete",
    what: "Anuló receta",
    metadata: { status: result.data.status },
  });

  revalidatePrescriptionSurfaces({
    patientId: result.data.patient_id,
    clinicalRecordId: result.data.clinical_record_id,
  });
  return { data: result.data };
}

export async function markPrescriptionDispensed(id: string) {
  const [access, supabase] = await Promise.all([requireClinicalIssueAccess(), createClient()]);
  if (!access.ok) return { error: access.error };

  const idParsed = parseEntityId(id, "Receta");
  if (!idParsed.ok) return { error: idParsed.error };
  const { data: before } = await supabase
    .from("prescription_drafts")
    .select("id, patient_id, clinical_record_id, status, dispensed_at")
    .eq("id", idParsed.data)
    .eq("clinic_id", access.data.clinicId)
    .maybeSingle();

  if (!before) return { error: "Receta no encontrada." };
  if (before.status !== "issued") return { error: "Solo se pueden marcar recetas emitidas." };
  if (before.dispensed_at) return { error: "La receta ya está marcada como dispensada." };

  const result = await markPrescriptionDispensedRecord(
    supabase,
    idParsed.data,
    access.data.clinicId,
    access.data.userId
  );
  if (!result.ok) return { error: result.error };

  await recordAudit({
    clinicId: access.data.clinicId,
    module: "prescriptions",
    entityType: "prescription",
    entityId: idParsed.data,
    patientId: before.patient_id,
    action: "update",
    what: "Marcó receta como dispensada",
    metadata: { dispensed_at: result.data.dispensed_at },
  });

  revalidatePrescriptionSurfaces({
    patientId: before.patient_id,
    clinicalRecordId: before.clinical_record_id,
  });
  return { data: result.data };
}
