import { format } from "date-fns";
import { es } from "date-fns/locale";

import type { ReminderChannel } from "@/types/database";

type NotificationPayload = {
  patient_name?: string;
  professional_name?: string;
  clinic_name?: string;
  start_at?: string;
  end_at?: string;
  status?: string;
  from_start_at?: string;
  to_start_at?: string;
  reason?: string;
};

const EVENT_LABELS: Record<string, string> = {
  confirmation: "confirmación de turno",
  reminder_48h: "recordatorio (48 hs)",
  reminder_24h: "recordatorio (24 hs)",
  cancellation: "cancelación de turno",
  reschedule: "reprogramación de turno",
};

function formatAppointmentDate(iso: string | undefined): string {
  if (!iso) return "fecha a confirmar";
  return format(new Date(iso), "PPPp", { locale: es });
}

export function buildAppointmentNotificationMessage(params: {
  eventType: string;
  channel: ReminderChannel;
  payload: NotificationPayload;
}): { subject: string; text: string } {
  const { eventType, payload } = params;
  const patientName = payload.patient_name ?? "Paciente";
  const professionalName = payload.professional_name ?? "el profesional";
  const clinicName = payload.clinic_name ?? "el consultorio";
  const dateLabel = formatAppointmentDate(payload.start_at);
  const eventLabel = EVENT_LABELS[eventType] ?? "notificación de turno";

  if (eventType === "cancellation") {
    const text = `Hola ${patientName}, tu turno del ${dateLabel} con ${professionalName} en ${clinicName} fue cancelado.`;
    return { subject: `Turno cancelado — ${clinicName}`, text };
  }

  if (eventType === "reschedule") {
    const fromLabel = formatAppointmentDate(payload.from_start_at);
    const toLabel = formatAppointmentDate(payload.to_start_at);
    const text = `Hola ${patientName}, tu turno en ${clinicName} fue reprogramado de ${fromLabel} a ${toLabel} con ${professionalName}.`;
    return { subject: `Turno reprogramado — ${clinicName}`, text };
  }

  if (eventType === "confirmation") {
    const text = `Hola ${patientName}, recibimos tu solicitud de turno para el ${dateLabel} con ${professionalName} en ${clinicName}. Te avisaremos cuando esté confirmado.`;
    return { subject: `Solicitud de turno recibida — ${clinicName}`, text };
  }

  const text = `Hola ${patientName}, te recordamos tu ${eventLabel} el ${dateLabel} con ${professionalName} en ${clinicName}.`;
  return { subject: `Recordatorio de turno — ${clinicName}`, text };
}
