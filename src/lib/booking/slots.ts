import {
  addMinutes,
  isBefore,
  parseISO,
} from "date-fns";
import {
  addClinicDays,
  clinicDayOfWeek,
  clinicLocalTimeToUtc,
  DEFAULT_CLINIC_TIMEZONE,
  formatClinicDateTime,
  startOfClinicDay,
} from "@/lib/utils/clinic-timezone";

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

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && aEnd > bStart;
}

export function generateAvailableSlots(params: {
  rules: AvailabilityRule[];
  appointments: TimeBlock[];
  blocks: TimeBlock[];
  daysAhead?: number;
  fromDate?: Date;
  timeZone?: string;
}): Array<{ start_at: string; end_at: string; label: string }> {
  const {
    rules,
    appointments,
    blocks,
    daysAhead = 14,
    fromDate = new Date(),
    timeZone = DEFAULT_CLINIC_TIMEZONE,
  } = params;

  const slots: Array<{ start_at: string; end_at: string; label: string }> = [];
  const now = new Date();
  const clinicToday = startOfClinicDay(fromDate, timeZone);

  for (let d = 0; d < daysAhead; d++) {
    const day = addClinicDays(clinicToday, d, timeZone);
    const dayRules = rules.filter((r) => r.day_of_week === clinicDayOfWeek(day, timeZone));

    for (const rule of dayRules) {
      let cursor = clinicLocalTimeToUtc(day, rule.start_time, timeZone);
      const dayEnd = clinicLocalTimeToUtc(day, rule.end_time, timeZone);

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
            const labelRaw = formatClinicDateTime(
              cursor,
              "EEE d 'de' MMM · HH:mm 'hs'",
              timeZone
            );
            slots.push({
              start_at: cursor.toISOString(),
              end_at: slotEnd.toISOString(),
              label: labelRaw.charAt(0).toUpperCase() + labelRaw.slice(1),
            });
          }
        }

        cursor = addMinutes(cursor, rule.slot_duration);
      }
    }
  }

  return slots.slice(0, 80);
}
