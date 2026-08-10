"use server";

import { format } from "date-fns";
import { es } from "date-fns/locale";
import { revalidatePath } from "next/cache";

import { requireClinicPermission } from "@/core/actions/clinic-guard";
import { getSession } from "@/core/auth/session.server";
import { scheduleAfterTask } from "@/core/errors/background.server";
import { enqueueClinicJob } from "@/core/jobs/enqueue";
import { processPendingClinicJobs } from "@/core/jobs/process";
import { recordAudit } from "@/core/security/audit-service";
import { verifyPaymentForeignKeys } from "@/core/security/ownership-guard";
import {
  APPOINTMENT_REMINDER_COLUMNS,
  APPOINTMENT_TELEMEDICINE_COLUMNS,
} from "@/core/supabase/select-columns";
import { createClient } from "@/core/supabase/server";
import { mockPaymentSchema } from "@/core/validations/cash-schemas";
import { firstZodIssue, parseEntityId, reminderChannelSchema } from "@/core/validations/params";

import { buildWhatsAppUrl } from "@/shared/utils/whatsapp";

import { buildPamiReminderMessage } from "@/lib/constants/pami-cabecera";
import { paymentService } from "@/lib/services/payments";
import { buildAppointmentReminderMessage, reminderService } from "@/lib/services/reminders";
import { telemedicineService } from "@/lib/services/telemedicine";

export async function sendReminder(appointmentId: string, channel: "email" | "whatsapp" | "internal") {
  const access = await requireClinicPermission("manageAppointments");
  if (!access.ok) return { error: access.error };
  const { clinicId } = access;

  const idParsed = parseEntityId(appointmentId, "Turno");
  if (!idParsed.ok) return { error: idParsed.error };

  const channelParsed = reminderChannelSchema.safeParse(channel);
  if (!channelParsed.success) return { error: "Canal inválido" };

  const supabase = await createClient();
  const { data: appointment } = await supabase
    .from("appointments")
    .select(`${APPOINTMENT_REMINDER_COLUMNS}, patients(first_name, last_name, email, phone), professionals(profiles(full_name))`)
    .eq("id", idParsed.data)
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
  const selectedChannel = channelParsed.data;
  const recipient =
    selectedChannel === "email"
      ? (patient.email ?? "")
      : selectedChannel === "whatsapp"
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

  if (selectedChannel === "whatsapp") {
    const result = await reminderService.send({
      clinicId,
      appointmentId: idParsed.data,
      recipient,
      channel: selectedChannel,
      message,
    });

    await supabase.from("reminder_logs").insert({
      clinic_id: clinicId,
      appointment_id: idParsed.data,
      recipient: result.recipient,
      channel: result.channel,
      status: result.status,
      message: result.message,
      sent_at: result.sent_at,
    });

    await recordAudit({
      clinicId,
      module: "appointments",
      entityType: "appointment",
      entityId: idParsed.data,
      patientId: appointment.patient_id as string | undefined,
      action: "update",
      what: "Envió recordatorio de turno",
      metadata: { channel: selectedChannel },
    });

    revalidatePath("/recordatorios");
    return {
      success: true,
      whatsappUrl: patient.phone ? buildWhatsAppUrl(patient.phone, message) : undefined,
      message,
    };
  }

  const user = await getSession();
  const { data: queuedLog } = await supabase
    .from("reminder_logs")
    .insert({
      clinic_id: clinicId,
      appointment_id: idParsed.data,
      recipient,
      channel: selectedChannel,
      status: "queued",
      message,
    })
    .select("id")
    .single();

  const { id: jobId } = await enqueueClinicJob(supabase, {
    clinicId,
    jobType: "send_reminder",
    payload: {
      appointmentId: idParsed.data,
      channel: selectedChannel,
      recipient,
      message,
      reminderLogId: queuedLog?.id,
    },
    createdBy: user?.id,
  });

  scheduleAfterTask(
    "sendReminder.background-worker",
    () => processPendingClinicJobs({ limit: 3, clinicId }),
    { clinicId }
  );

  await recordAudit({
    clinicId,
    module: "appointments",
    entityType: "appointment",
    entityId: idParsed.data,
    patientId: appointment.patient_id as string | undefined,
    action: "update",
    what: "Encoló recordatorio de turno",
    metadata: { channel: selectedChannel, jobId },
  });

  revalidatePath("/recordatorios");
  return {
    success: true,
    queued: true,
    jobId,
    message,
  };
}

export async function createTelemedicineSession(appointmentId: string) {
  const access = await requireClinicPermission("viewClinicalRecords");
  if (!access.ok) return { error: access.error };
  const { clinicId } = access;
  const user = await getSession();

  const idParsed = parseEntityId(appointmentId, "Turno");
  if (!idParsed.ok) return { error: idParsed.error };

  const supabase = await createClient();
  const { data: appointment } = await supabase
    .from("appointments")
    .select(`${APPOINTMENT_TELEMEDICINE_COLUMNS}, patients(first_name, last_name)`)
    .eq("id", idParsed.data)
    .eq("clinic_id", clinicId)
    .single();

  if (!appointment) return { error: "Turno no encontrado" };

  const patient = appointment.patients as unknown as { first_name: string; last_name: string };
  const room = await telemedicineService.createRoom(
    idParsed.data,
    `${patient.first_name} ${patient.last_name}`
  );

  const { data, error } = await supabase.rpc("create_telemedicine_session_atomic", {
    p_clinic_id: clinicId,
    p_appointment_id: idParsed.data,
    p_room_url: room.roomUrl,
    p_status: room.status,
    p_created_by: user?.id ?? null,
  });

  if (error) return { error: error.message };

  await recordAudit({
    clinicId,
    module: "appointments",
    entityType: "appointment",
    entityId: idParsed.data,
    patientId: appointment.patient_id as string | undefined,
    action: "create",
    what: "Creó sesión de telemedicina",
    metadata: { session_id: (data as { id: string }).id },
  });

  revalidatePath("/telemedicina");
  revalidatePath("/atenciones");
  return { data };
}

export async function createMockPayment(formData: FormData) {
  const access = await requireClinicPermission("managePayments");
  if (!access.ok) return { error: access.error };
  const { clinicId } = access;

  const parsed = mockPaymentSchema.safeParse({
    patient_id: formData.get("patient_id"),
    appointment_id: formData.get("appointment_id") || undefined,
    amount: formData.get("amount"),
    deposit_amount: formData.get("deposit_amount") ?? 0,
  });
  if (!parsed.success) return { error: firstZodIssue(parsed.error) };

  const { patient_id: patientId, appointment_id: appointmentId, amount, deposit_amount: depositAmount } =
    parsed.data;

  const supabase = await createClient();
  const ownership = await verifyPaymentForeignKeys(supabase, clinicId, {
    patientId,
    appointmentId,
  });
  if (!ownership.ok) return { error: ownership.error };

  const result = await paymentService.createPayment({
    clinicId,
    patientId,
    appointmentId,
    amount,
    depositAmount,
  });

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

  await recordAudit({
    clinicId,
    module: "cash",
    entityType: "payment",
    entityId: data.id,
    patientId,
    action: "create",
    metadata: { amount, appointment_id: appointmentId ?? null },
  });

  revalidatePath("/pagos");
  return { data };
}
