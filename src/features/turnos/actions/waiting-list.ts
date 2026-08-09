"use server";

import { revalidatePath } from "next/cache";

import { requireClinicPermission } from "@/core/actions/clinic-guard";
import { getSession } from "@/core/auth/session.server";
import { verifyPatientInClinic, verifyProfessionalInClinic } from "@/core/security/ownership-guard";
import { createClient } from "@/core/supabase/server";
import { firstZodIssue } from "@/core/validations/params";
import { sanitizeText } from "@/core/validations/schemas";

import { waitingListEntrySchema } from "@/features/turnos/utils/turno-wizard-schema";

export async function addToWaitingList(input: unknown) {
  const access = await requireClinicPermission("manageAppointments");
  if (!access.ok) return { error: access.error };
  const { clinicId } = access;
  const user = await getSession();

  const parsed = waitingListEntrySchema.safeParse(input);
  if (!parsed.success) return { error: firstZodIssue(parsed.error) };

  const data = parsed.data;
  const supabase = await createClient();

  const ownership = await verifyPatientInClinic(supabase, clinicId, data.patient_id);
  if (!ownership.ok) return { error: ownership.error };

  if (data.professional_id) {
    const professional = await verifyProfessionalInClinic(
      supabase,
      clinicId,
      data.professional_id
    );
    if (!professional.ok) return { error: professional.error };
  }

  const { data: row, error } = await supabase
    .from("waiting_list")
    .insert({
      clinic_id: clinicId,
      patient_id: data.patient_id,
      professional_id: data.professional_id ?? null,
      specialty_id: data.specialty_id ?? null,
      location_id: data.location_id ?? null,
      preferred_date_from: data.preferred_date_from ?? null,
      preferred_date_to: data.preferred_date_to ?? null,
      preferred_time_from: data.preferred_time_from ?? null,
      preferred_time_to: data.preferred_time_to ?? null,
      consultation_modality: data.consultation_modality,
      notes: data.notes ? sanitizeText(data.notes) : null,
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  revalidatePath("/turnos/lista-espera");
  return { data: row };
}

export async function updateWaitingListStatus(id: string, status: "active" | "contacted" | "scheduled" | "cancelled") {
  const access = await requireClinicPermission("manageAppointments");
  if (!access.ok) return { error: access.error };
  const { clinicId } = access;

  const supabase = await createClient();
  const { error } = await supabase
    .from("waiting_list")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("clinic_id", clinicId);

  if (error) return { error: error.message };

  revalidatePath("/turnos/lista-espera");
  return { success: true };
}
