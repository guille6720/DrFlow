/** Pure helpers for scheduling a follow-up appointment from the consultation journey. */

export const CONSULTATION_FOLLOW_UP_DEFAULT_DURATION = 30;

export const CONSULTATION_FOLLOW_UP_DEFAULT_NOTES = "Control de seguimiento";

export function defaultFollowUpStartAt(from = new Date()): string {
  const base = new Date(from);
  base.setDate(base.getDate() + 30);
  base.setHours(9, 0, 0, 0);
  return new Date(base.getTime() - base.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export function validateFollowUpProfessional(professionalId?: string | null): string | null {
  if (!professionalId?.trim()) {
    return "Seleccioná un profesional para agendar el turno.";
  }
  return null;
}

export type FollowUpAppointmentInput = {
  patientId: string;
  professionalId: string;
  startAt: string;
  duration?: number;
  notes?: string;
};

/** Builds server-action payload; validation lives in appointmentSchema on the server. */
export function buildFollowUpAppointmentFormData(input: FollowUpAppointmentInput): FormData {
  const duration = input.duration ?? CONSULTATION_FOLLOW_UP_DEFAULT_DURATION;
  const start = new Date(input.startAt);
  const end = new Date(start.getTime() + duration * 60000);
  const formData = new FormData();
  formData.set("patient_id", input.patientId);
  formData.set("professional_id", input.professionalId);
  formData.set("status", "pending");
  formData.set("start_at", input.startAt);
  formData.set("end_at", end.toISOString());
  formData.set("duration", String(duration));
  formData.set("notes", input.notes?.trim() || CONSULTATION_FOLLOW_UP_DEFAULT_NOTES);
  return formData;
}
