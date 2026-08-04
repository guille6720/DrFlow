"use server";

import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { prescriptionDraftSchema } from "@/lib/validations/schemas";
import { requireClinicalIssueAccess } from "@/lib/services/clinical-access.service";
import {
  buildPrescriptionPayload,
  issuePrescriptionRecord,
  savePrescriptionDraftRecord,
  voidPrescriptionRecord,
} from "@/lib/services/prescriptions.service";

export async function savePrescriptionDraft(formData: FormData) {
  const access = await requireClinicalIssueAccess();
  if (!access.ok) return { error: access.error };
  const { userId, clinicId } = access.data;

  const parsed = prescriptionDraftSchema.safeParse(buildPrescriptionPayload(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = await createClient();
  const existingId = formData.get("id");
  const result = await savePrescriptionDraftRecord(supabase, {
    clinicId,
    userId,
    parsed: parsed.data,
    existingDraftId: existingId ? String(existingId) : null,
  });

  if (!result.ok) return { error: result.error };

  if (!existingId) {
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

  const supabase = await createClient();
  const result = await issuePrescriptionRecord(supabase, id, access.data.clinicId);
  if (!result.ok) return { error: result.error };

  revalidatePath("/recetas");
  revalidatePath("/historias");
  return { data: result.data };
}

export async function voidPrescription(id: string) {
  const access = await requireClinicalIssueAccess();
  if (!access.ok) return { error: access.error };

  const supabase = await createClient();
  const result = await voidPrescriptionRecord(supabase, id, access.data.clinicId);
  if (!result.ok) return { error: result.error };

  revalidatePath("/recetas");
  revalidatePath("/historias");
  return { data: result.data };
}
