export const APPOINTMENT_HOUR_START = 8;
export const APPOINTMENT_HOUR_END = 20;
export const APPOINTMENT_SLOT_MINUTES = 30;

export function buildAppointmentTimeSlots() {
  const slots: string[] = [];
  for (let h = APPOINTMENT_HOUR_START; h < APPOINTMENT_HOUR_END; h++) {
    for (let m = 0; m < 60; m += APPOINTMENT_SLOT_MINUTES) {
      slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }
  return slots;
}

export const APPOINTMENT_TIME_SLOTS = buildAppointmentTimeSlots();

export function toLocalDatetimeValue(date: Date, time: string) {
  const [h, m] = time.split(":").map(Number);
  const d = new Date(date);
  d.setHours(h, m, 0, 0);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

import { startOfDay } from "date-fns";

export function parseLocalDatetimeValue(value: string): { date: Date; time: string } | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return { date: startOfDay(d), time };
}
