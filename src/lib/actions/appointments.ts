"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSession, logAudit } from "@/lib/auth/session";
import { appointmentSchema } from "@/lib/validations/schemas";
import { requireClinicPermission } from "@/lib/actions/clinic-guard";
import type { ConsultationModality } from "@/lib/constants/consultation-modality";

export async function createAppointment(formData: FormData) {
  const access = await requireClinicPermission("manageAppointments");
  if (!access.ok) return { error: access.error };
  const { clinicId } = access;
  const user = await getSession();

  const raw = Object.fromEntries(formData.entries());
  const parsed = appointmentSchema.safeParse({
    ...raw,
    location_id: raw.location_id || null,
    specialty_id: raw.specialty_id || null,
  });

  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("appointments")
    .insert({
      clinic_id: clinicId,
      ...parsed.data,
      created_by: user?.id,
    })
    .select()
    .single();

  if (error) {
    if (error.message.includes("turno en ese horario")) {
      return { error: "El profesional ya tiene un turno en ese horario." };
    }
    return { error: error.message };
  }

  await logAudit({
    clinicId,
    entityType: "appointment",
    entityId: data.id,
    action: "create",
  });

  revalidatePath("/agenda");
  revalidatePath("/dashboard");
  revalidatePath("/atenciones");
  return { data };
}

export async function updateAppointmentStatus(
  id: string,
  status: string,
  cancellationReason?: string,
  consultationModality?: ConsultationModality
) {
  const access = await requireClinicPermission("manageAppointments");
  if (!access.ok) return { error: access.error };
  const { clinicId } = access;
  const user = await getSession();

  const supabase = await createClient();

  const { data: before } = await supabase
    .from("appointments")
    .select("id, start_at, patient_id, patients(first_name, last_name, phone)")
    .eq("id", id)
    .eq("clinic_id", clinicId)
    .single();

  const updatePayload: Record<string, unknown> = {
    status,
    cancellation_reason: status === "cancelled" ? (cancellationReason?.trim() || null) : null,
  };

  if (status === "cancelled") {
    updatePayload.cancelled_at = new Date().toISOString();
    updatePayload.cancelled_by = user?.id ?? null;
    updatePayload.cancelled_by_type = "clinic";
  }

  if (status === "attended") {
    updatePayload.consultation_modality = consultationModality ?? "presencial";
  }

  const { error } = await supabase
    .from("appointments")
    .update(updatePayload)
    .eq("id", id)
    .eq("clinic_id", clinicId);

  if (error) return { error: error.message };

  await logAudit({
    clinicId,
    entityType: "appointment",
    entityId: id,
    action: "update",
    metadata: {
      status,
      cancellationReason: cancellationReason ?? null,
      cancelledBy: status === "cancelled" ? "clinic" : undefined,
    },
  });

  revalidatePath("/agenda");
  revalidatePath("/dashboard");
  revalidatePath(`/pacientes/${before?.patient_id}`);
  revalidatePath("/atenciones");

  const patient = before?.patients as
    | { first_name: string; last_name: string; phone: string | null }
    | { first_name: string; last_name: string; phone: string | null }[]
    | null;
  const patientRow = Array.isArray(patient) ? patient[0] : patient;

  return {
    success: true,
    whatsapp:
      status === "confirmed" && patientRow?.phone
        ? {
            phone: patientRow.phone,
            firstName: patientRow.first_name,
            startAt: before?.start_at as string,
          }
        : null,
  };
}

export async function startConsultationFromAppointment(appointmentId: string) {
  const access = await requireClinicPermission("editClinicalRecords");
  if (!access.ok) return { error: access.error };
  const { clinicId } = access;

  const supabase = await createClient();
  const { data: appointment } = await supabase
    .from("appointments")
    .select("id, status, patient_id, professional_id")
    .eq("id", appointmentId)
    .eq("clinic_id", clinicId)
    .single();

  if (!appointment) return { error: "Turno no encontrado" };

  if (appointment.status === "pending") {
    await supabase
      .from("appointments")
      .update({ status: "confirmed", updated_at: new Date().toISOString() })
      .eq("id", appointmentId)
      .eq("clinic_id", clinicId);
  }

  revalidatePath("/agenda");
  return {
    patientId: appointment.patient_id as string,
    professionalId: appointment.professional_id as string,
    appointmentId: appointment.id as string,
  };
}

export async function finalizeConsultation(
  appointmentId: string,
  consultationModality: ConsultationModality = "presencial"
) {
  const access = await requireClinicPermission("editClinicalRecords");
  if (!access.ok) return { error: access.error };
  const { clinicId } = access;

  const supabase = await createClient();
  const { error } = await supabase
    .from("appointments")
    .update({
      status: "attended",
      consultation_modality: consultationModality,
      updated_at: new Date().toISOString(),
    })
    .eq("id", appointmentId)
    .eq("clinic_id", clinicId);

  if (error) return { error: error.message };

  revalidatePath("/agenda");
  revalidatePath("/dashboard");
  revalidatePath("/atenciones");
  return { success: true };
}
