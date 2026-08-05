"use server";

import { revalidatePath } from "next/cache";

import { logAudit } from "@/core/auth/session";
import { recordAudit } from "@/core/security/audit-service";
import { requireClinicalIssueAccess } from "@/core/services/clinical-access.service";
import { createClient } from "@/core/supabase/server";
import { firstZodIssue, optionalEntityIdSchema, parseEntityId } from "@/core/validations/params";
import { prescriptionDraftSchema } from "@/core/validations/schemas";

import {
  buildPrescriptionPayload,
  issuePrescriptionRecord,
  savePrescriptionDraftRecord,
  voidPrescriptionRecord,
} from "@/features/recetas/services/prescriptions.service";

export async function savePrescriptionDraft(formData: FormData) {
  const access = await requireClinicalIssueAccess();
  if (!access.ok) return { error: access.error };
  const { userId, clinicId } = access.data;

  const parsed = prescriptionDraftSchema.safeParse(buildPrescriptionPayload(formData));
  if (!parsed.success) return { error: firstZodIssue(parsed.error) };

  const rawId = formData.get("id");
  const existingParsed = optionalEntityIdSchema.safeParse(
    typeof rawId === "string" && rawId.trim() ? rawId.trim() : null
  );
  if (!existingParsed.success) return { error: "Borrador inválido" };

  const supabase = await createClient();
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

  revalidatePath("/recetas");
  revalidatePath("/historias");
  return { data: result.data };
}

export async function issuePrescription(id: string) {
  const access = await requireClinicalIssueAccess();
  if (!access.ok) return { error: access.error };

  const idParsed = parseEntityId(id, "Receta");
  if (!idParsed.ok) return { error: idParsed.error };

  const supabase = await createClient();
  const { data: before } = await supabase
    .from("prescription_drafts")
    .select("id, patient_id, status")
    .eq("id", idParsed.data)
    .eq("clinic_id", access.data.clinicId)
    .maybeSingle();

  const result = await issuePrescriptionRecord(supabase, idParsed.data, access.data.clinicId);
  if (!result.ok) return { error: result.error };

  await recordAudit({
    clinicId: access.data.clinicId,
    module: "prescriptions",
    entityType: "prescription",
    entityId: idParsed.data,
    patientId: before?.patient_id ?? undefined,
    action: "update",
    what: "Emitió receta electrónica",
    metadata: { status: "issued" },
  });

  revalidatePath("/recetas");
  revalidatePath("/historias");
  return { data: result.data };
}

export async function voidPrescription(id: string) {
  const access = await requireClinicalIssueAccess();
  if (!access.ok) return { error: access.error };

  const idParsed = parseEntityId(id, "Receta");
  if (!idParsed.ok) return { error: idParsed.error };

  const supabase = await createClient();
  const { data: before } = await supabase
    .from("prescription_drafts")
    .select("id, patient_id, status")
    .eq("id", idParsed.data)
    .eq("clinic_id", access.data.clinicId)
    .maybeSingle();

  const result = await voidPrescriptionRecord(supabase, idParsed.data, access.data.clinicId);
  if (!result.ok) return { error: result.error };

  await recordAudit({
    clinicId: access.data.clinicId,
    module: "prescriptions",
    entityType: "prescription",
    entityId: idParsed.data,
    patientId: before?.patient_id ?? undefined,
    action: "delete",
    what: "Anuló receta",
    metadata: { previousStatus: before?.status },
  });

  revalidatePath("/recetas");
  revalidatePath("/historias");
  return { data: result.data };
}
