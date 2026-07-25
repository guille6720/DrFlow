"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/auth/session";
import { patientSchema, sanitizePatientFields } from "@/lib/validations/schemas";
import { requireClinicPermission } from "@/lib/actions/clinic-guard";

export async function createPatient(formData: FormData) {
  const access = await requireClinicPermission("managePatients");
  if (!access.ok) return { error: access.error };
  const { clinicId } = access;

  const raw = Object.fromEntries(formData.entries());
  const parsed = patientSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message };
  }

  const supabase = await createClient();
  const { data: clinic } = await supabase
    .from("clinics")
    .select("default_insurance_provider, accepted_coverages")
    .eq("id", clinicId)
    .single();

  const insuranceProvider =
    parsed.data.insurance_provider?.trim() ||
    clinic?.default_insurance_provider ||
    null;

  const sanitized = sanitizePatientFields(parsed.data);

  const { data, error } = await supabase
    .from("patients")
    .insert({
      clinic_id: clinicId,
      ...sanitized,
      insurance_provider: insuranceProvider,
      email: sanitized.email || null,
      birth_date: sanitized.birth_date || null,
    })
    .select()
    .single();

  if (error) return { error: error.message };

  await logAudit({
    clinicId,
    entityType: "patient",
    entityId: data.id,
    action: "create",
  });

  revalidatePath("/pacientes");
  return { data };
}

export async function updatePatient(id: string, formData: FormData) {
  const access = await requireClinicPermission("managePatients");
  if (!access.ok) return { error: access.error };
  const { clinicId } = access;

  const raw = Object.fromEntries(formData.entries());
  const parsed = patientSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const sanitized = sanitizePatientFields(parsed.data);

  const supabase = await createClient();
  const { error } = await supabase
    .from("patients")
    .update({
      ...sanitized,
      email: sanitized.email || null,
      birth_date: sanitized.birth_date || null,
    })
    .eq("id", id)
    .eq("clinic_id", clinicId);

  if (error) return { error: error.message };

  await logAudit({ clinicId, entityType: "patient", entityId: id, action: "update" });
  revalidatePath("/pacientes");
  revalidatePath(`/pacientes/${id}`);
  return { success: true };
}
