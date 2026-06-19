"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  getActiveClinicId,
  getSession,
  logAudit,
} from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions/roles";
import { getActiveClinic } from "@/lib/auth/session";
import {
  appointmentSchema,
  patientSchema,
  clinicalRecordSchema,
  sanitizeText,
} from "@/lib/validations/schemas";
import { reminderService, buildAppointmentReminderMessage } from "@/lib/services/reminders";
import { buildPamiReminderMessage } from "@/lib/constants/pami-cabecera";
import { buildWhatsAppUrl } from "@/lib/utils/whatsapp";
import { paymentService } from "@/lib/services/payments";
import { telemedicineService } from "@/lib/services/telemedicine";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export async function createPatient(formData: FormData) {
  const clinicId = await getActiveClinicId();
  const { role, isSuperadmin } = await getActiveClinic();
  if (!clinicId || !hasPermission(role, "managePatients", isSuperadmin)) {
    return { error: "Sin permisos" };
  }

  const raw = Object.fromEntries(formData.entries());
  const parsed = patientSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message };
  }

  const supabase = await createClient();
  const { data: clinic } = await supabase
    .from("clinics")
    .select("default_insurance_provider")
    .eq("id", clinicId)
    .single();

  const insuranceProvider =
    parsed.data.insurance_provider?.trim() ||
    clinic?.default_insurance_provider ||
    null;

  const { data, error } = await supabase
    .from("patients")
    .insert({
      clinic_id: clinicId,
      ...parsed.data,
      insurance_provider: insuranceProvider,
      first_name: sanitizeText(parsed.data.first_name),
      last_name: sanitizeText(parsed.data.last_name),
      email: parsed.data.email || null,
      birth_date: parsed.data.birth_date || null,
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
  const clinicId = await getActiveClinicId();
  const { role, isSuperadmin } = await getActiveClinic();
  if (!clinicId || !hasPermission(role, "managePatients", isSuperadmin)) {
    return { error: "Sin permisos" };
  }

  const raw = Object.fromEntries(formData.entries());
  const parsed = patientSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = await createClient();
  const { error } = await supabase
    .from("patients")
    .update({
      ...parsed.data,
      email: parsed.data.email || null,
      birth_date: parsed.data.birth_date || null,
    })
    .eq("id", id)
    .eq("clinic_id", clinicId);

  if (error) return { error: error.message };

  await logAudit({ clinicId, entityType: "patient", entityId: id, action: "update" });
  revalidatePath("/pacientes");
  revalidatePath(`/pacientes/${id}`);
  return { success: true };
}

export async function createAppointment(formData: FormData) {
  const clinicId = await getActiveClinicId();
  const user = await getSession();
  const { role, isSuperadmin } = await getActiveClinic();
  if (!clinicId || !hasPermission(role, "manageAppointments", isSuperadmin)) {
    return { error: "Sin permisos" };
  }

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
  return { data };
}

export async function updateAppointmentStatus(
  id: string,
  status: string,
  cancellationReason?: string
) {
  const clinicId = await getActiveClinicId();
  const user = await getSession();
  const { role, isSuperadmin } = await getActiveClinic();
  if (!clinicId || !hasPermission(role, "manageAppointments", isSuperadmin)) {
    return { error: "Sin permisos" };
  }

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

export async function createClinicalRecord(formData: FormData) {
  const clinicId = await getActiveClinicId();
  const user = await getSession();
  const { role, isSuperadmin } = await getActiveClinic();
  if (!clinicId || !hasPermission(role, "editClinicalRecords", isSuperadmin)) {
    return { error: "Sin permisos" };
  }

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
      created_by: user!.id,
    })
    .select()
    .single();

  if (error) return { error: error.message };

  if (parsed.data.appointment_id) {
    await supabase
      .from("appointments")
      .update({ status: "attended", updated_at: new Date().toISOString() })
      .eq("id", parsed.data.appointment_id)
      .eq("clinic_id", clinicId);
    revalidatePath("/agenda");
    revalidatePath("/dashboard");
  }

  await supabase.from("clinical_record_audit").insert({
    clinical_record_id: data.id,
    clinic_id: clinicId,
    action: "create",
    changed_by: user!.id,
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

export async function startConsultationFromAppointment(appointmentId: string) {
  const clinicId = await getActiveClinicId();
  const { role, isSuperadmin } = await getActiveClinic();
  if (!clinicId || !hasPermission(role, "editClinicalRecords", isSuperadmin)) {
    return { error: "Sin permisos" };
  }

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

export async function finalizeConsultation(appointmentId: string) {
  const clinicId = await getActiveClinicId();
  const { role, isSuperadmin } = await getActiveClinic();
  if (!clinicId || !hasPermission(role, "editClinicalRecords", isSuperadmin)) {
    return { error: "Sin permisos" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("appointments")
    .update({ status: "attended", updated_at: new Date().toISOString() })
    .eq("id", appointmentId)
    .eq("clinic_id", clinicId);

  if (error) return { error: error.message };

  revalidatePath("/agenda");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function updateClinicalRecord(id: string, formData: FormData) {
  const clinicId = await getActiveClinicId();
  const user = await getSession();
  const { role, isSuperadmin } = await getActiveClinic();
  if (!clinicId || !hasPermission(role, "editClinicalRecords", isSuperadmin)) {
    return { error: "Sin permisos" };
  }

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
    updated_by: user!.id,
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
    changed_by: user!.id,
    old_values: old,
    new_values: data,
  });

  revalidatePath("/historias");
  revalidatePath(`/historias/${id}`);
  return { success: true };
}

export async function sendReminder(appointmentId: string, channel: "email" | "whatsapp" | "internal") {
  const clinicId = await getActiveClinicId();
  if (!clinicId) return { error: "Sin clínica activa" };

  const supabase = await createClient();
  const { data: appointment } = await supabase
    .from("appointments")
    .select("*, patients(first_name, last_name, email, phone), professionals(profiles(full_name))")
    .eq("id", appointmentId)
    .eq("clinic_id", clinicId)
    .single();

  if (!appointment) return { error: "Turno no encontrado" };

  const { data: clinicRow } = await supabase
    .from("clinics")
    .select("name, practice_profile")
    .eq("id", clinicId)
    .single();

  const patient = appointment.patients as unknown as { first_name: string; last_name: string; email: string | null; phone: string | null };
  const recipient =
    channel === "email"
      ? patient.email ?? ""
      : channel === "whatsapp"
        ? patient.phone ?? ""
        : "internal";

  if (!recipient) return { error: "El paciente no tiene contacto para este canal" };

  const profName = (appointment.professionals as unknown as { profiles?: { full_name?: string } })?.profiles?.full_name ?? "el profesional";
  const dateLabel = format(new Date(appointment.start_at), "PPPp", { locale: es });
  const patientFullName = `${patient.first_name} ${patient.last_name}`;

  const message =
    clinicRow?.practice_profile === "cabecera_pami"
      ? buildPamiReminderMessage(
          patientFullName,
          dateLabel,
          profName,
          clinicRow?.name ?? "consultorio"
        )
      : buildAppointmentReminderMessage(patientFullName, dateLabel, profName);

  const result = await reminderService.send({
    clinicId,
    appointmentId,
    recipient,
    channel,
    message,
  });

  await supabase.from("reminder_logs").insert({
    clinic_id: clinicId,
    appointment_id: appointmentId,
    recipient: result.recipient,
    channel: result.channel,
    status: result.status,
    message: result.message,
    sent_at: result.sent_at,
  });

  revalidatePath("/recordatorios");
  return {
    success: true,
    whatsappUrl:
      channel === "whatsapp" && patient.phone
        ? buildWhatsAppUrl(patient.phone, message)
        : undefined,
    message,
  };
}

export async function createTelemedicineSession(appointmentId: string) {
  const clinicId = await getActiveClinicId();
  const user = await getSession();
  if (!clinicId) return { error: "Sin clínica activa" };

  const supabase = await createClient();
  const { data: appointment } = await supabase
    .from("appointments")
    .select("*, patients(first_name, last_name)")
    .eq("id", appointmentId)
    .eq("clinic_id", clinicId)
    .single();

  if (!appointment) return { error: "Turno no encontrado" };

  const patient = appointment.patients as unknown as { first_name: string; last_name: string };
  const room = await telemedicineService.createRoom(
    appointmentId,
    `${patient.first_name} ${patient.last_name}`
  );

  const { data, error } = await supabase
    .from("telemedicine_sessions")
    .insert({
      clinic_id: clinicId,
      appointment_id: appointmentId,
      room_url: room.roomUrl,
      status: room.status,
      created_by: user?.id,
    })
    .select()
    .single();

  if (error) return { error: error.message };

  revalidatePath("/telemedicina");
  return { data };
}

export async function createMockPayment(formData: FormData) {
  const clinicId = await getActiveClinicId();
  const { role, isSuperadmin } = await getActiveClinic();
  if (!clinicId || !hasPermission(role, "managePayments", isSuperadmin)) {
    return { error: "Sin permisos" };
  }

  const patientId = formData.get("patient_id") as string;
  const appointmentId = (formData.get("appointment_id") as string) || undefined;
  const amount = parseFloat(formData.get("amount") as string);
  const depositAmount = parseFloat((formData.get("deposit_amount") as string) || "0");

  if (!patientId || isNaN(amount)) return { error: "Datos inválidos" };

  const result = await paymentService.createPayment({
    clinicId,
    patientId,
    appointmentId,
    amount,
    depositAmount,
  });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payments")
    .insert({
      clinic_id: clinicId,
      patient_id: patientId,
      appointment_id: appointmentId ?? null,
      amount,
      deposit_amount: depositAmount,
      status: result.status,
      mock_transaction_id: result.mockTransactionId,
      paid_at: result.paidAt,
    })
    .select()
    .single();

  if (error) return { error: error.message };

  revalidatePath("/pagos");
  return { data };
}
