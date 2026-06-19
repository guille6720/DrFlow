"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getActiveClinicId, getSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions/roles";
import { getActiveClinic } from "@/lib/auth/session";

export async function recordPatientAppShare(
  patientId: string,
  channel: "whatsapp" | "copy"
) {
  const clinicId = await getActiveClinicId();
  const { role, isSuperadmin } = await getActiveClinic();
  const session = await getSession();

  if (!clinicId || !hasPermission(role, "managePatients", isSuperadmin)) {
    return { error: "Sin permisos" };
  }

  const supabase = await createClient();

  const { data: patient } = await supabase
    .from("patients")
    .select("id")
    .eq("id", patientId)
    .eq("clinic_id", clinicId)
    .single();

  if (!patient) return { error: "Paciente no encontrado" };

  const { data: existing } = await supabase
    .from("patient_app_share_log")
    .select("id, shared_at")
    .eq("patient_id", patientId)
    .maybeSingle();

  if (existing) {
    return {
      error: "Ya se compartió la app con este paciente",
      sharedAt: existing.shared_at,
    };
  }

  const { data, error } = await supabase
    .from("patient_app_share_log")
    .insert({
      clinic_id: clinicId,
      patient_id: patientId,
      shared_by: session?.id ?? null,
      channel,
    })
    .select("shared_at")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { error: "Ya se compartió la app con este paciente" };
    }
    return { error: error.message };
  }

  revalidatePath("/pacientes");
  revalidatePath(`/pacientes/${patientId}`);

  return { success: true, sharedAt: data.shared_at };
}

export async function getPortalSlugForClinic(clinicId: string): Promise<string | null> {
  const supabase = await createClient();

  const [{ data: link }, { data: clinic }] = await Promise.all([
    supabase
      .from("public_booking_links")
      .select("slug")
      .eq("clinic_id", clinicId)
      .eq("is_active", true)
      .maybeSingle(),
    supabase.from("clinics").select("slug").eq("id", clinicId).single(),
  ]);

  return link?.slug ?? clinic?.slug ?? null;
}
