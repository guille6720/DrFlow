"use server";

import { revalidatePath } from "next/cache";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth/session";
import { reminderService, buildAppointmentReminderMessage } from "@/lib/services/reminders";
import { buildPamiReminderMessage } from "@/lib/constants/pami-cabecera";
import { buildWhatsAppUrl } from "@/lib/utils/whatsapp";
import { paymentService } from "@/lib/services/payments";
import { telemedicineService } from "@/lib/services/telemedicine";
import { requireActiveClinic, requireClinicPermission } from "@/lib/actions/clinic-guard";

export async function sendReminder(appointmentId: string, channel: "email" | "whatsapp" | "internal") {
  const access = await requireActiveClinic();
  if (!access.ok) return { error: access.error };
  const { clinicId } = access;

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

  const patient = appointment.patients as unknown as {
    first_name: string;
    last_name: string;
    email: string | null;
    phone: string | null;
  };
  const recipient =
    channel === "email"
      ? (patient.email ?? "")
      : channel === "whatsapp"
        ? (patient.phone ?? "")
        : "internal";

  if (!recipient) return { error: "El paciente no tiene contacto para este canal" };

  const profName =
    (appointment.professionals as unknown as { profiles?: { full_name?: string } })?.profiles
      ?.full_name ?? "el profesional";
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
  const access = await requireActiveClinic();
  if (!access.ok) return { error: access.error };
  const { clinicId } = access;
  const user = await getSession();

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

  await supabase
    .from("appointments")
    .update({ consultation_modality: "virtual", updated_at: new Date().toISOString() })
    .eq("id", appointmentId)
    .eq("clinic_id", clinicId);

  revalidatePath("/telemedicina");
  revalidatePath("/atenciones");
  return { data };
}

export async function createMockPayment(formData: FormData) {
  const access = await requireClinicPermission("managePayments");
  if (!access.ok) return { error: access.error };
  const { clinicId } = access;

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
