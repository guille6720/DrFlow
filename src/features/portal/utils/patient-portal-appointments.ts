import type { PatientRequestChannel, PatientRequestType } from "@/features/pacientes/utils/patient-requests-storage";

export type PatientPortalAppointmentRow = {
  appointmentId: string;
  status: string;
  startAt: string;
  endAt: string;
  bookingSource: string | null;
  cancellationReason: string | null;
  cancelledAt: string | null;
  cancelledByType: string | null;
  professionalName: string | null;
  patientName: string;
  createdAt: string;
};

export type PatientRequestItem = {
  id: string;
  appointmentId?: string;
  type: PatientRequestType;
  channel: PatientRequestChannel;
  patientName: string;
  startAt?: string;
  createdAt: string;
  status?: string;
  cancellationReason?: string | null;
  cancelledAt?: string | null;
  cancelledByType?: string | null;
  professionalName?: string | null;
};

export function mapPortalAppointmentToRequestItem(
  row: PatientPortalAppointmentRow
): PatientRequestItem {
  return {
    id: row.appointmentId,
    appointmentId: row.appointmentId,
    type: "turno",
    channel: "web",
    patientName: row.patientName,
    startAt: row.startAt,
    createdAt: row.createdAt,
    status: row.status,
    cancellationReason: row.cancellationReason,
    cancelledAt: row.cancelledAt,
    cancelledByType: row.cancelledByType,
    professionalName: row.professionalName,
  };
}

export function mergePatientRequestItems(
  serverItems: PatientRequestItem[],
  localWhatsappItems: PatientRequestItem[]
): PatientRequestItem[] {
  const serverIds = new Set(serverItems.map((item) => item.appointmentId).filter(Boolean));
  const whatsappOnly = localWhatsappItems.filter(
    (item) => !item.appointmentId || !serverIds.has(item.appointmentId)
  );
  return [...serverItems, ...whatsappOnly].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}
