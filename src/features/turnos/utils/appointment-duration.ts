import { addMinutes, parseISO } from "date-fns";

export const APPOINTMENT_DURATION_OPTIONS = [15, 20, 30, 45, 60] as const;

export type AppointmentDurationMinutes = (typeof APPOINTMENT_DURATION_OPTIONS)[number];

export const DEFAULT_APPOINTMENT_DURATION_MINUTES = 30;

type TimeBlock = { start_at: string; end_at: string };

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && aEnd > bStart;
}

export function slotSupportsDuration(
  startAt: string,
  durationMinutes: number,
  appointments: TimeBlock[],
  blocks: TimeBlock[]
): boolean {
  const start = parseISO(startAt);
  const end = addMinutes(start, durationMinutes);

  for (const appointment of appointments) {
    if (overlaps(start, end, parseISO(appointment.start_at), parseISO(appointment.end_at))) {
      return false;
    }
  }

  for (const block of blocks) {
    if (overlaps(start, end, parseISO(block.start_at), parseISO(block.end_at))) {
      return false;
    }
  }

  return true;
}

export function filterSlotsByDuration<T extends { start_at: string }>(
  slots: T[],
  durationMinutes: number,
  appointments: TimeBlock[],
  blocks: TimeBlock[]
): T[] {
  return slots.filter((slot) =>
    slotSupportsDuration(slot.start_at, durationMinutes, appointments, blocks)
  );
}

export function resolveAppointmentEndAt(startAt: string, durationMinutes: number): string {
  return addMinutes(parseISO(startAt), durationMinutes).toISOString();
}
