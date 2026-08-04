import { formatInTimeZone, fromZonedTime, toZonedTime } from "date-fns-tz";
import { es } from "date-fns/locale";

export const DEFAULT_CLINIC_TIMEZONE = "America/Argentina/Buenos_Aires";

export function formatClinicDateTime(
  isoOrDate: string | Date,
  pattern: string,
  timeZone: string = DEFAULT_CLINIC_TIMEZONE
): string {
  const iso = typeof isoOrDate === "string" ? isoOrDate : isoOrDate.toISOString();
  return formatInTimeZone(iso, timeZone, pattern, { locale: es });
}

/** Interpreta HH:mm como hora de pared en la zona de la clínica → Date UTC. */
export function clinicLocalTimeToUtc(
  day: Date,
  time: string,
  timeZone: string = DEFAULT_CLINIC_TIMEZONE
): Date {
  const zonedDay = toZonedTime(day, timeZone);
  const [h, m] = time.split(":").map(Number);
  const local = new Date(
    zonedDay.getFullYear(),
    zonedDay.getMonth(),
    zonedDay.getDate(),
    h,
    m ?? 0,
    0,
    0
  );
  return fromZonedTime(local, timeZone);
}

export function startOfClinicDay(
  date: Date,
  timeZone: string = DEFAULT_CLINIC_TIMEZONE
): Date {
  const zoned = toZonedTime(date, timeZone);
  return fromZonedTime(
    new Date(zoned.getFullYear(), zoned.getMonth(), zoned.getDate(), 0, 0, 0, 0),
    timeZone
  );
}

export function addClinicDays(
  date: Date,
  days: number,
  timeZone: string = DEFAULT_CLINIC_TIMEZONE
): Date {
  const zoned = toZonedTime(date, timeZone);
  return fromZonedTime(
    new Date(zoned.getFullYear(), zoned.getMonth(), zoned.getDate() + days, 0, 0, 0, 0),
    timeZone
  );
}

export function clinicDayOfWeek(
  date: Date,
  timeZone: string = DEFAULT_CLINIC_TIMEZONE
): number {
  return toZonedTime(date, timeZone).getDay();
}
