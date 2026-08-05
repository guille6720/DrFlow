"use server";

import { revalidatePath } from "next/cache";

import { requireClinicPermission } from "@/core/actions/clinic-guard";
import { getSession, logAudit } from "@/core/auth/session.server";
import { recordAudit } from "@/core/security/audit-service";
import { verifyAppointmentForeignKeys } from "@/core/security/ownership-guard";
import { createClient } from "@/core/supabase/server";
import {
  appointmentStatusSchema,
  consultationModalitySchema,
  firstZodIssue,
  parseEntityId,
} from "@/core/validations/params";
import { appointmentSchema, sanitizeText, updateAppointmentBodySchema } from "@/core/validations/schemas";

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

  if (!parsed.success) return { error: firstZodIssue(parsed.error) };

  const payload = {
    ...parsed.data,
    notes: parsed.data.notes ? sanitizeText(parsed.data.notes) : parsed.data.notes,
    cancellation_reason: parsed.data.cancellation_reason
      ? sanitizeText(parsed.data.cancellation_reason)
      : parsed.data.cancellation_reason,
  };

  const supabase = await createClient();
  const ownership = await verifyAppointmentForeignKeys(supabase, clinicId, {
    patientId: parsed.data.patient_id,
    professionalId: parsed.data.professional_id,
    locationId: parsed.data.location_id,
    specialtyId: parsed.data.specialty_id,
  });
  if (!ownership.ok) return { error: ownership.error };

  const { data, error } = await supabase
    .from("appointments")
    .insert({
      clinic_id: clinicId,
      ...payload,
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

export async function updateAppointment(id: string, formData: FormData) {
  const access = await requireClinicPermission("manageAppointments");
  if (!access.ok) return { error: access.error };
  const { clinicId } = access;

  const idParsed = parseEntityId(id, "Turno");
  if (!idParsed.ok) return { error: idParsed.error };

  const raw = Object.fromEntries(formData.entries());

  const bodyParsed = updateAppointmentBodySchema.safeParse({
    ...raw,
    location_id: raw.location_id || null,
    specialty_id: raw.specialty_id || null,
  });

  if (!bodyParsed.success) return { error: firstZodIssue(bodyParsed.error) };

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("appointments")
    .select("id, status, patient_id")
    .eq("id", idParsed.data)
    .eq("clinic_id", clinicId)
    .single();

  if (!existing) return { error: "Turno no encontrado" };
  if (existing.status === "cancelled" || existing.status === "attended") {
    return { error: "No se puede modificar un turno cancelado o ya atendido." };
  }

  const ownership = await verifyAppointmentForeignKeys(supabase, clinicId, {
    patientId: bodyParsed.data.patient_id,
    professionalId: bodyParsed.data.professional_id,
    locationId: bodyParsed.data.location_id,
    specialtyId: bodyParsed.data.specialty_id,
  });
  if (!ownership.ok) return { error: ownership.error };

  const payload = {
    patient_id: bodyParsed.data.patient_id,
    professional_id: bodyParsed.data.professional_id,
    location_id: bodyParsed.data.location_id,
    specialty_id: bodyParsed.data.specialty_id,
    start_at: bodyParsed.data.start_at,
    end_at: bodyParsed.data.end_at,
    notes: bodyParsed.data.notes ? sanitizeText(bodyParsed.data.notes) : bodyParsed.data.notes,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("appointments")
    .update(payload)
    .eq("id", idParsed.data)
    .eq("clinic_id", clinicId);

  if (error) {
    if (error.message.includes("turno en ese horario")) {
      return { error: "El profesional ya tiene un turno en ese horario." };
    }
    return { error: error.message };
  }

  await logAudit({
    clinicId,
    entityType: "appointment",
    entityId: idParsed.data,
    action: "update",
  });

  revalidatePath("/agenda");
  revalidatePath("/dashboard");
  revalidatePath(`/pacientes/${existing.patient_id}`);
  revalidatePath("/atenciones");
  return { success: true };
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

  const idParsed = parseEntityId(id, "Turno");
  if (!idParsed.ok) return { error: idParsed.error };

  const statusParsed = appointmentStatusSchema.safeParse(status);
  if (!statusParsed.success) return { error: "Estado inválido" };

  const modalityParsed = consultationModalitySchema.safeParse(consultationModality ?? "presencial");
  if (!modalityParsed.success) return { error: "Modalidad inválida" };

  const supabase = await createClient();

  const { data: before } = await supabase
    .from("appointments")
    .select("id, start_at, patient_id, patients(first_name, last_name, phone)")
    .eq("id", idParsed.data)
    .eq("clinic_id", clinicId)
    .single();

  const updatePayload: Record<string, unknown> = {
    status: statusParsed.data,
    cancellation_reason:
      statusParsed.data === "cancelled"
        ? cancellationReason?.trim()
          ? sanitizeText(cancellationReason.slice(0, 500))
          : null
        : null,
  };

  if (statusParsed.data === "cancelled") {
    updatePayload.cancelled_at = new Date().toISOString();
    updatePayload.cancelled_by = user?.id ?? null;
    updatePayload.cancelled_by_type = "clinic";
  }

  if (statusParsed.data === "attended") {
    updatePayload.consultation_modality = modalityParsed.data;
  }

  const { error } = await supabase
    .from("appointments")
    .update(updatePayload)
    .eq("id", idParsed.data)
    .eq("clinic_id", clinicId);

  if (error) return { error: error.message };

  await logAudit({
    clinicId,
    entityType: "appointment",
    entityId: idParsed.data,
    action: "update",
    metadata: {
      status: statusParsed.data,
      cancellationReason: cancellationReason ?? null,
      cancelledBy: statusParsed.data === "cancelled" ? "clinic" : undefined,
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
      statusParsed.data === "confirmed" && patientRow?.phone
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

  const idParsed = parseEntityId(appointmentId, "Turno");
  if (!idParsed.ok) return { error: idParsed.error };

  const supabase = await createClient();
  const { data: appointment } = await supabase
    .from("appointments")
    .select("id, status, patient_id, professional_id")
    .eq("id", idParsed.data)
    .eq("clinic_id", clinicId)
    .single();

  if (!appointment) return { error: "Turno no encontrado" };

  if (appointment.status === "pending") {
    await supabase
      .from("appointments")
      .update({ status: "confirmed", updated_at: new Date().toISOString() })
      .eq("id", idParsed.data)
      .eq("clinic_id", clinicId);
  }

  await recordAudit({
    clinicId,
    module: "appointments",
    entityType: "appointment",
    entityId: idParsed.data,
    patientId: appointment.patient_id as string,
    action: "update",
    what: "Inició consulta desde turno",
    metadata: { from_status: appointment.status },
  });

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

  const idParsed = parseEntityId(appointmentId, "Turno");
  if (!idParsed.ok) return { error: idParsed.error };

  const modalityParsed = consultationModalitySchema.safeParse(consultationModality);
  if (!modalityParsed.success) return { error: "Modalidad inválida" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("appointments")
    .update({
      status: "attended",
      consultation_modality: modalityParsed.data,
      updated_at: new Date().toISOString(),
    })
    .eq("id", idParsed.data)
    .eq("clinic_id", clinicId);

  if (error) return { error: error.message };

  await recordAudit({
    clinicId,
    module: "appointments",
    entityType: "appointment",
    entityId: idParsed.data,
    action: "update",
    what: "Finalizó consulta",
    metadata: { status: "attended", consultation_modality: modalityParsed.data },
  });

  revalidatePath("/agenda");
  revalidatePath("/dashboard");
  revalidatePath("/atenciones");
  return { success: true };
}
