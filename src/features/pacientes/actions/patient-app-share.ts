"use server";

import { revalidatePath } from "next/cache";

import { getActiveClinicId, getSession } from "@/core/auth/session.server";
import { getActiveClinic } from "@/core/auth/session.server";
import { hasPermission } from "@/core/permissions/roles";
import { createClient } from "@/core/supabase/server";
import { appShareChannelSchema, parseEntityId } from "@/core/validations/params";

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

  const idParsed = parseEntityId(patientId, "Paciente");
  if (!idParsed.ok) return { error: idParsed.error };

  const channelParsed = appShareChannelSchema.safeParse(channel);
  if (!channelParsed.success) return { error: "Canal inválido" };

  const supabase = await createClient();

  const { data: patient } = await supabase
    .from("patients")
    .select("id")
    .eq("id", idParsed.data)
    .eq("clinic_id", clinicId)
    .single();

  if (!patient) return { error: "Paciente no encontrado" };

  const { data: existing } = await supabase
    .from("patient_app_share_log")
    .select("id, shared_at")
    .eq("patient_id", idParsed.data)
    .maybeSingle();

  if (existing) {
    const { data, error } = await supabase
      .from("patient_app_share_log")
      .update({
        shared_at: new Date().toISOString(),
        shared_by: session?.id ?? null,
        channel: channelParsed.data,
      })
      .eq("id", existing.id)
      .select("shared_at")
      .single();

    if (error) return { error: error.message };

    revalidatePath("/pacientes");
    revalidatePath(`/pacientes/${idParsed.data}`);
    return { success: true, sharedAt: data.shared_at, resent: true };
  }

  const { data, error } = await supabase
    .from("patient_app_share_log")
    .insert({
      clinic_id: clinicId,
      patient_id: idParsed.data,
      shared_by: session?.id ?? null,
      channel: channelParsed.data,
    })
    .select("shared_at")
    .single();

  if (error) return { error: error.message };

  revalidatePath("/pacientes");
  revalidatePath(`/pacientes/${idParsed.data}`);

  return { success: true, sharedAt: data.shared_at, resent: false };
}
