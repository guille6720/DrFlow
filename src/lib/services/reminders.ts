import { recordObservabilityEvent } from "@/core/observability/record";

import type { ReminderChannel, ReminderLog } from "@/types/database";

export interface ReminderPayload {
  clinicId: string;
  appointmentId: string;
  recipient: string;
  channel: ReminderChannel;
  message: string;
}

export interface ReminderService {
  send(payload: ReminderPayload): Promise<ReminderLog>;
}

class MockReminderService implements ReminderService {
  async send(payload: ReminderPayload): Promise<ReminderLog> {
    void recordObservabilityEvent({
      clinicId: payload.clinicId,
      category: "job",
      name: "mock_reminder_send",
      status: "ok",
      metadata: {
        channel: payload.channel,
        recipient: payload.recipient,
        appointmentId: payload.appointmentId,
        simulated: true,
      },
    });

    return {
      id: crypto.randomUUID(),
      clinic_id: payload.clinicId,
      appointment_id: payload.appointmentId,
      recipient: payload.recipient,
      channel: payload.channel,
      status: "simulated",
      message: payload.message,
      sent_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };
  }
}

export const reminderService: ReminderService = new MockReminderService();

export function buildAppointmentReminderMessage(
  patientName: string,
  date: string,
  professionalName: string
): string {
  return `Hola ${patientName}, te recordamos tu turno el ${date} con ${professionalName}. NexClinic — Centro Médico.`;
}
