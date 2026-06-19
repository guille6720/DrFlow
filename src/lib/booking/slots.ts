import {
  addDays,
  addMinutes,
  format,
  getDay,
  isBefore,
  parseISO,
  setHours,
  setMinutes,
  startOfDay,
} from "date-fns";
import { es } from "date-fns/locale";

export interface AvailabilityRule {
  day_of_week: number;
  start_time: string;
  end_time: string;
  slot_duration: number;
}

export interface TimeBlock {
  start_at: string;
  end_at: string;
}

function parseTimeOnDate(date: Date, time: string): Date {
  const [h, m] = time.split(":").map(Number);
  return setMinutes(setHours(date, h), m ?? 0);
}

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && aEnd > bStart;
}

export function generateAvailableSlots(params: {
  rules: AvailabilityRule[];
  appointments: TimeBlock[];
  blocks: TimeBlock[];
  daysAhead?: number;
  fromDate?: Date;
}): Array<{ start_at: string; end_at: string; label: string }> {
  const {
    rules,
    appointments,
    blocks,
    daysAhead = 14,
    fromDate = new Date(),
  } = params;

  const slots: Array<{ start_at: string; end_at: string; label: string }> = [];
  const now = new Date();

  for (let d = 0; d < daysAhead; d++) {
    const day = startOfDay(addDays(fromDate, d));
    const dayRules = rules.filter((r) => r.day_of_week === getDay(day));

    for (const rule of dayRules) {
      let cursor = parseTimeOnDate(day, rule.start_time);
      const dayEnd = parseTimeOnDate(day, rule.end_time);

      while (addMinutes(cursor, rule.slot_duration) <= dayEnd) {
        const slotEnd = addMinutes(cursor, rule.slot_duration);

        if (!isBefore(slotEnd, now)) {
          const busy =
            appointments.some((a) =>
              overlaps(cursor, slotEnd, parseISO(a.start_at), parseISO(a.end_at))
            ) ||
            blocks.some((b) =>
              overlaps(cursor, slotEnd, parseISO(b.start_at), parseISO(b.end_at))
            );

          if (!busy) {
            const label = format(cursor, "EEE d 'de' MMM · HH:mm 'hs'", { locale: es });
            slots.push({
              start_at: cursor.toISOString(),
              end_at: slotEnd.toISOString(),
              label: label.charAt(0).toUpperCase() + label.slice(1),
            });
          }
        }

        cursor = addMinutes(cursor, rule.slot_duration);
      }
    }
  }

  return slots.slice(0, 80);
}
