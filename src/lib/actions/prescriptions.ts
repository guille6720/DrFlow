"use server";

import { revalidatePath } from "next/cache";
import { getActiveClinic, getActiveClinicId, getSession } from "@/lib/auth/session";
import { logAudit } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions/roles";
import { createClient } from "@/lib/supabase/server";
import { prescriptionDraftSchema, sanitizeText } from "@/lib/validations/schemas";
import type { ElectronicPrescription } from "@/types/prescription";

function formatPrescriptionDbError(message: string): string {
  if (
    message.includes("diagnosis_cie10") ||
    message.includes("prescription_type") ||
    message.includes("schema cache")
  ) {
    return (
      "Falta la migración de recetas en Supabase. Ejecutá en el SQL Editor el archivo " +
      "supabase/migrations/014_repair_prescription_schema.sql (o 013) y volvé a intentar."
    );
  }
  return message;
}

function parseMedicationsJson(raw: unknown) {
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  return raw;
}

function buildPrescriptionPayload(formData: FormData) {
  const medicationsRaw = formData.get("medications_json");
  const medications = parseMedicationsJson(medicationsRaw);

  return {
    patient_id: String(formData.get("patient_id") ?? ""),
    clinical_record_id: String(formData.get("clinical_record_id") ?? "") || null,
    professional_id: String(formData.get("professional_id") ?? ""),
    prescription_type: String(formData.get("prescription_type") ?? "ambulatoria"),
    diagnosis_cie10: String(formData.get("diagnosis_cie10") ?? ""),
    diagnosis_text: String(formData.get("diagnosis_text") ?? ""),
    patient_insurance: String(formData.get("patient_insurance") ?? "") || undefined,
    medications,
    notes: String(formData.get("notes") ?? "") || undefined,
    validity_days: Number(formData.get("validity_days") ?? 30),
    disclaimer_accepted: formData.get("disclaimer_accepted") === "on" || formData.get("disclaimer_accepted") === "true",
  };
}

async function assertCanIssue() {
  const user = await getSession();
  const clinicId = await getActiveClinicId();
  const { role, isSuperadmin } = await getActiveClinic();
  if (!user || !clinicId) return { error: "Sesión requerida" as const };
  if (!hasPermission(role, "issuePrescriptions", isSuperadmin)) {
    return { error: "Solo médicos pueden emitir recetas" as const };
  }
  return { user, clinicId };
}

export async function savePrescriptionDraft(formData: FormData) {
  const access = await assertCanIssue();
  if ("error" in access && access.error) return { error: access.error };
  const { user, clinicId } = access;

  const parsed = prescriptionDraftSchema.safeParse(buildPrescriptionPayload(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = await createClient();
  const payload = {
    clinic_id: clinicId,
    patient_id: parsed.data.patient_id,
    clinical_record_id: parsed.data.clinical_record_id,
    professional_id: parsed.data.professional_id,
    prescription_type: parsed.data.prescription_type,
    diagnosis_cie10: sanitizeText(parsed.data.diagnosis_cie10),
    diagnosis_text: sanitizeText(parsed.data.diagnosis_text),
    patient_insurance: parsed.data.patient_insurance
      ? sanitizeText(parsed.data.patient_insurance)
      : null,
    medications: parsed.data.medications,
    notes: parsed.data.notes ? sanitizeText(parsed.data.notes) : null,
    validity_days: parsed.data.validity_days,
    disclaimer_accepted: true,
    status: "draft",
    refeps_status: "local",
    created_by: user!.id,
  };

  const id = formData.get("id");
  if (id) {
    const { data, error } = await supabase
      .from("prescription_drafts")
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq("id", String(id))
      .eq("clinic_id", clinicId)
      .eq("status", "draft")
      .select()
      .single();

    if (error) return { error: formatPrescriptionDbError(error.message) };
    revalidatePath("/recetas");
    revalidatePath("/historias");
    return { data: data as ElectronicPrescription };
  }

  const { data, error } = await supabase
    .from("prescription_drafts")
    .insert(payload)
    .select()
    .single();

  if (error) return { error: formatPrescriptionDbError(error.message) };

  await logAudit({
    clinicId,
    entityType: "prescription",
    entityId: data.id,
    action: "create",
  });

  revalidatePath("/recetas");
  revalidatePath("/historias");
  return { data: data as ElectronicPrescription };
}

export async function issuePrescription(id: string) {
  const access = await assertCanIssue();
  if ("error" in access && access.error) return { error: access.error };
  const { clinicId } = access;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("prescription_drafts")
    .update({
      status: "issued",
      issued_at: new Date().toISOString(),
      refeps_status: "local",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("clinic_id", clinicId)
    .eq("status", "draft")
    .select()
    .single();

  if (error) return { error: formatPrescriptionDbError(error.message) };

  revalidatePath("/recetas");
  revalidatePath("/historias");
  return { data: data as ElectronicPrescription };
}

export async function voidPrescription(id: string) {
  const access = await assertCanIssue();
  if ("error" in access && access.error) return { error: access.error };
  const { clinicId } = access;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("prescription_drafts")
    .update({
      status: "void",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("clinic_id", clinicId)
    .in("status", ["draft", "issued"])
    .select()
    .single();

  if (error) return { error: formatPrescriptionDbError(error.message) };

  revalidatePath("/recetas");
  revalidatePath("/historias");
  return { data: data as ElectronicPrescription };
}
