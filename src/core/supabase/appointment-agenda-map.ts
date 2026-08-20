import type {
  AppointmentAgendaRow,
  AppointmentBookingSource,
} from "@/core/supabase/query-types";

import type { ConsultationModality } from "@/types/database";

/** DB check (migration 104): booking_source IN ('manual', 'online', 'api'). */
export function normalizeBookingSource(
  value: string | null | undefined
): AppointmentBookingSource | null {
  if (value === "manual" || value === "online" || value === "api") return value;
  return null;
}

/** Known product values for cancelled_by_type. Unknown → null. */
export function normalizeCancelledByType(
  value: string | null | undefined
): "patient" | "clinic" | null {
  if (value === "patient" || value === "clinic") return value;
  return null;
}

/** DB check: consultation_modality IN ('presencial', 'virtual'). */
export function normalizeConsultationModality(
  value: string | null | undefined
): ConsultationModality | null {
  if (value === "presencial" || value === "virtual") return value;
  return null;
}

type AgendaRowInput = Omit<
  AppointmentAgendaRow,
  "booking_source" | "cancelled_by_type" | "consultation_modality"
> & {
  booking_source?: string | null;
  cancelled_by_type?: string | null;
  consultation_modality?: string | null;
};

/** Map a Supabase appointments row (string columns) into the agenda contract. */
export function toAppointmentAgendaRow(row: AgendaRowInput): AppointmentAgendaRow {
  return {
    ...row,
    booking_source: normalizeBookingSource(row.booking_source) ?? undefined,
    cancelled_by_type: normalizeCancelledByType(row.cancelled_by_type),
    consultation_modality: normalizeConsultationModality(row.consultation_modality) ?? undefined,
  };
}

export function toAppointmentAgendaRows(
  rows: readonly AgendaRowInput[] | null | undefined
): AppointmentAgendaRow[] {
  return (rows ?? []).map(toAppointmentAgendaRow);
}
