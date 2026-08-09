import type { AppointmentStatus } from "@/types/database";

export type AppointmentLifecycleLabel =
  | "Pendiente"
  | "Confirmado"
  | "Presente"
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

  if (input.waitingRoomStatus === "in_consultation") return "En atención";
  if (input.waitingRoomStatus === "waiting" || input.waitingRoomStatus === "confirmed") {
    return "Presente";
  }

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

export const BLOCK_REASON_OPTIONS = [
  { value: "vacation", label: "Vacaciones" },
  { value: "leave", label: "Licencia" },
  { value: "meeting", label: "Reunión" },
  { value: "holiday", label: "Feriado" },
  { value: "maintenance", label: "Mantenimiento" },
  { value: "manual", label: "Bloqueo manual" },
  { value: "other", label: "Otro" },
] as const;
