import type { AppointmentStatus } from "@/types/database";

export type AppointmentLifecycleLabel =
  | "Pendiente"
  | "Confirmado"
  | "Presente"
  | "En espera"
  | "En atención"
  | "Atendido"
  | "Cancelado"
  | "Reprogramado"
  | "Ausente"
  | "Sobreturno";

export type WaitingRoomStatus =
  | "waiting"
  | "confirmed"
  | "in_consultation"
  | "finished"
  | "cancelled"
  | "absent";

export function resolveAppointmentLifecycleLabel(input: {
  status: AppointmentStatus;
  waitingRoomStatus?: WaitingRoomStatus | null;
  waitingRoomEnteredAt?: string | null;
  isOverbooking?: boolean;
  rescheduledAt?: string | null;
}): AppointmentLifecycleLabel {
  if (input.isOverbooking && input.status === "pending") return "Sobreturno";

  if (
    input.rescheduledAt &&
    (input.status === "pending" || input.status === "confirmed")
  ) {
    return "Reprogramado";
  }

  const arrived = hasArrivedToClinic(input.waitingRoomEnteredAt);

  if (input.waitingRoomStatus === "in_consultation") return "En atención";
  if (input.waitingRoomStatus === "waiting" && arrived) return "En espera";
  if (input.waitingRoomStatus === "confirmed") return "Presente";
  if (input.waitingRoomStatus === "absent") return "Ausente";

  switch (input.status) {
    case "pending":
      return "Pendiente";
    case "confirmed":
      return "Confirmado";
    case "attended":
      return "Atendido";
    case "cancelled":
      return "Cancelado";
    case "no_show":
      return "Ausente";
    default:
      return "Pendiente";
  }
}

export const APPOINTMENT_STATUS_BADGE_CLASS: Record<AppointmentLifecycleLabel, string> = {
  Pendiente: "bg-amber-100 text-amber-900",
  Confirmado: "bg-sky-100 text-sky-900",
  Presente: "bg-violet-100 text-violet-900",
  "En espera": "bg-amber-100 text-amber-900",
  "En atención": "bg-indigo-100 text-indigo-900",
  Atendido: "bg-emerald-100 text-emerald-900",
  Cancelado: "bg-neutral-200 text-neutral-700",
  Reprogramado: "bg-orange-100 text-orange-900",
  Ausente: "bg-red-100 text-red-900",
  Sobreturno: "bg-fuchsia-100 text-fuchsia-900 ring-2 ring-fuchsia-400",
};

export const CANCELLATION_REASON_OPTIONS = [
  { value: "patient", label: "Paciente" },
  { value: "professional", label: "Profesional" },
  { value: "clinic", label: "Clínica" },
  { value: "data_error", label: "Error de carga" },
  { value: "other", label: "Otro" },
] as const;

export type CancellationCategory = (typeof CANCELLATION_REASON_OPTIONS)[number]["value"];

const CANCELLATION_CATEGORY_LABEL: Record<CancellationCategory, string> = {
  patient: "Paciente",
  professional: "Profesional",
  clinic: "Clínica",
  data_error: "Error de carga",
  other: "Otro",
};

export function formatCancellationReason(
  category: CancellationCategory | string | null | undefined,
  detail: string | null | undefined
): string {
  const label =
    category && category in CANCELLATION_CATEGORY_LABEL
      ? CANCELLATION_CATEGORY_LABEL[category as CancellationCategory]
      : "Otro";
  const trimmed = detail?.trim() ?? "";
  return trimmed ? `${label}: ${trimmed}` : label;
}

export function lifecycleLabelToBadgeVariant(
  label: AppointmentLifecycleLabel
): "default" | "success" | "warning" | "danger" | "info" | "brand" {
  switch (label) {
    case "Confirmado":
    case "Presente":
      return "info";
    case "Atendido":
      return "success";
    case "Pendiente":
    case "En espera":
      return "warning";
    case "Cancelado":
    case "Ausente":
      return "danger";
    case "Reprogramado":
      return "brand";
    case "Sobreturno":
      return "brand";
    case "En atención":
      return "info";
    default:
      return "default";
  }
}

export const AGENDA_ATTENDANCE_OPTIONS = [
  { value: "confirmed", label: "Presente" },
  { value: "absent", label: "Ausente" },
  { value: "waiting", label: "En espera" },
] as const;

export type AgendaAttendanceValue = (typeof AGENDA_ATTENDANCE_OPTIONS)[number]["value"];

/** True after reception marks Presente or En espera (not when the turno is first booked). */
export function hasArrivedToClinic(waitingRoomEnteredAt?: string | null): boolean {
  return Boolean(waitingRoomEnteredAt);
}

export function resolveAgendaAttendanceValue(input: {
  status: AppointmentStatus;
  waitingRoomStatus?: WaitingRoomStatus | null;
  waitingRoomEnteredAt?: string | null;
}): AgendaAttendanceValue | null {
  if (input.waitingRoomStatus === "confirmed") return "confirmed";
  if (input.waitingRoomStatus === "waiting" && hasArrivedToClinic(input.waitingRoomEnteredAt)) {
    return "waiting";
  }
  if (input.waitingRoomStatus === "absent" || input.status === "no_show") return "absent";
  return null;
}

export function canSetAgendaAttendance(input: {
  status: AppointmentStatus;
  waitingRoomStatus?: WaitingRoomStatus | null;
}): boolean {
  if (input.status === "cancelled" || input.status === "attended") return false;
  if (
    input.waitingRoomStatus === "in_consultation" ||
    input.waitingRoomStatus === "finished" ||
    input.waitingRoomStatus === "cancelled"
  ) {
    return false;
  }
  return true;
}

export function isWaitingRoomQueueStatus(
  status?: WaitingRoomStatus | null
): boolean {
  return status === "waiting" || status === "confirmed";
}

/** Compact `MM:SS` or `H:MM:SS` wait-time label. */
export function formatWaitingRoomElapsed(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  if (hours > 0) return `${hours}:${mm}:${ss}`;
  return `${mm}:${ss}`;
}

export const BLOCK_REASON_OPTIONS = [
  { value: "vacation", label: "Vacaciones" },
  { value: "leave", label: "Licencia" },
  { value: "meeting", label: "Reunión" },
  { value: "holiday", label: "Feriado" },
  { value: "maintenance", label: "Mantenimiento" },
  { value: "manual", label: "Bloqueo manual" },
  { value: "other", label: "Otro" },
] as const;
