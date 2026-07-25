"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSession, logAudit } from "@/lib/auth/session";
import { clinicalRecordSchema, sanitizeText } from "@/lib/validations/schemas";
import { parseConsultationModality } from "@/lib/constants/consultation-modality";
import { requireClinicPermission } from "@/lib/actions/clinic-guard";

export async function createClinicalRecord(formData: FormData) {
  const access = await requireClinicPermission("editClinicalRecords");
  if (!access.ok) return { error: access.error };
  const { clinicId } = access;
  const user = await getSession();
  if (!user) return { error: "Sin sesión" };

  const raw = Object.fromEntries(formData.entries());
  const parsed = clinicalRecordSchema.safeParse({
    ...raw,
    appointment_id: raw.appointment_id || null,
  });

  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clinical_records")
    .insert({
      clinic_id: clinicId,
      ...parsed.data,
      chief_complaint: sanitizeText(parsed.data.chief_complaint ?? ""),
      diagnosis: sanitizeText(parsed.data.diagnosis ?? ""),
      evolution: sanitizeText(parsed.data.evolution ?? ""),
      indications: sanitizeText(parsed.data.indications ?? ""),
      created_by: user.id,
    })
    .select()
    .single();

  if (error) return { error: error.message };

  if (parsed.data.appointment_id) {
    const modality = parseConsultationModality(raw.consultation_modality);
    await supabase
      .from("appointments")
      .update({
        status: "attended",
        consultation_modality: modality,
        updated_at: new Date().toISOString(),
      })
      .eq("id", parsed.data.appointment_id)
      .eq("clinic_id", clinicId);
    revalidatePath("/agenda");
    revalidatePath("/dashboard");
    revalidatePath("/atenciones");
  }

  await supabase.from("clinical_record_audit").insert({
    clinical_record_id: data.id,
    clinic_id: clinicId,
    action: "create",
    changed_by: user.id,
    new_values: data,
  });

  await logAudit({
    clinicId,
    entityType: "clinical_record",
    entityId: data.id,
    action: "create",
  });

  revalidatePath("/historias");
  return { data };
}

export async function updateClinicalRecord(id: string, formData: FormData) {
  const access = await requireClinicPermission("editClinicalRecords");
  if (!access.ok) return { error: access.error };
  const { clinicId } = access;
  const user = await getSession();
  if (!user) return { error: "Sin sesión" };

  const raw = Object.fromEntries(formData.entries());
  const parsed = clinicalRecordSchema.safeParse({
    ...raw,
    appointment_id: raw.appointment_id || null,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = await createClient();
  const { data: old } = await supabase
    .from("clinical_records")
    .select("*")
    .eq("id", id)
    .eq("clinic_id", clinicId)
    .single();

  if (!old) return { error: "Consulta no encontrada" };

  const updates = {
    ...parsed.data,
    chief_complaint: sanitizeText(parsed.data.chief_complaint ?? ""),
    diagnosis: sanitizeText(parsed.data.diagnosis ?? ""),
    evolution: sanitizeText(parsed.data.evolution ?? ""),
    indications: sanitizeText(parsed.data.indications ?? ""),
    updated_by: user.id,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("clinical_records")
    .update(updates)
    .eq("id", id)
    .eq("clinic_id", clinicId)
    .select()
    .single();

  if (error) return { error: error.message };

  await supabase.from("clinical_record_audit").insert({
    clinical_record_id: id,
    clinic_id: clinicId,
    action: "update",
    changed_by: user.id,
    old_values: old,
    new_values: data,
  });

  revalidatePath("/historias");
  revalidatePath(`/historias/${id}`);
  return { success: true };
}
