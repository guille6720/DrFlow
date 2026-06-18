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
    // Simulated send — replace with SendGrid/Twilio later
    console.log(`[MOCK REMINDER] ${payload.channel} → ${payload.recipient}: ${payload.message}`);

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
  return `Hola ${patientName}, te recordamos tu turno el ${date} con ${professionalName}. DrFlow — Centro Médico.`;
}
