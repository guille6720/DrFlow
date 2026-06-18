"use server";

import { revalidatePath } from "next/cache";
import { getActiveClinic, getActiveClinicId, getSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions/roles";
import { createClient } from "@/lib/supabase/server";
import { sanitizeText } from "@/lib/validations/schemas";
import type { MedicalOrder } from "@/types/medical-order";

async function assertCanIssue() {
  const user = await getSession();
  const clinicId = await getActiveClinicId();
  const { role, isSuperadmin } = await getActiveClinic();
  if (!user || !clinicId) return { error: "Sesión requerida" as const };
  if (!hasPermission(role, "issuePrescriptions", isSuperadmin)) {
    return { error: "Solo médicos pueden emitir órdenes" as const };
  }
  return { user, clinicId };
}

export async function createMedicalOrder(formData: FormData) {
  const access = await assertCanIssue();
  if ("error" in access && access.error) return { error: access.error };
  const { user, clinicId } = access;

  const patientId = String(formData.get("patient_id") ?? "");
  const professionalId = String(formData.get("professional_id") ?? "");
  const orderText = sanitizeText(String(formData.get("order_text") ?? ""));
  const notes = String(formData.get("notes") ?? "").trim();
  const clinicalRecordId = String(formData.get("clinical_record_id") ?? "") || null;

  if (!patientId || !professionalId || !orderText) {
    return { error: "Paciente, profesional y orden son obligatorios." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("medical_orders")
    .insert({
      clinic_id: clinicId,
      patient_id: patientId,
      professional_id: professionalId,
      clinical_record_id: clinicalRecordId,
      order_text: orderText,
      notes: notes ? sanitizeText(notes) : null,
      order_type: String(formData.get("order_type") ?? "study"),
      status: "issued",
      issued_at: new Date().toISOString(),
      created_by: user!.id,
    })
    .select()
    .single();

  if (error) {
    if (error.message.includes("medical_orders") || error.message.includes("schema cache")) {
      return {
        error:
          "Falta la migración 015 en Supabase (supabase/migrations/015_drapp_inspired_features.sql).",
      };
    }
    return { error: error.message };
  }

  revalidatePath("/historias");
  return { data: data as MedicalOrder };
}

export async function voidMedicalOrder(id: string) {
  const access = await assertCanIssue();
  if ("error" in access && access.error) return { error: access.error };
  const { clinicId } = access;

  const supabase = await createClient();
  const { error } = await supabase
    .from("medical_orders")
    .update({ status: "void", updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("clinic_id", clinicId);

  if (error) return { error: error.message };

  revalidatePath("/historias");
  return { success: true };
}
