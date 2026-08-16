import { es } from "date-fns/locale";
import { formatInTimeZone, fromZonedTime, toZonedTime } from "date-fns-tz";

export const DEFAULT_CLINIC_TIMEZONE = "America/Argentina/Buenos_Aires";

export function formatClinicDateTime(
  isoOrDate: string | Date | null | undefined,
  pattern: string,
  timeZone: string = DEFAULT_CLINIC_TIMEZONE
): string {
  if (isoOrDate == null || isoOrDate === "") return "—";

  const iso = typeof isoOrDate === "string" ? isoOrDate : isoOrDate.toISOString();
  if (Number.isNaN(Date.parse(iso))) return "—";

  try {
    return formatInTimeZone(iso, timeZone, pattern, { locale: es });
  } catch {
    return "—";
  }
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

/**
 * Ventana de turnos activos para Sala de espera / Consultas:
 * ayer → mañana (zona clínica), para no perder pacientes marcados Presente
 * en un día distinto al “hoy” del servidor.
 */
export function clinicActiveQueueRange(
  now: Date = new Date(),
  timeZone: string = DEFAULT_CLINIC_TIMEZONE
): { startIso: string; endExclusiveIso: string } {
  const todayStart = startOfClinicDay(now, timeZone);
  return {
    startIso: addClinicDays(todayStart, -1, timeZone).toISOString(),
    endExclusiveIso: addClinicDays(todayStart, 2, timeZone).toISOString(),
  };
}

export function clinicDayOfWeek(
  date: Date,
  timeZone: string = DEFAULT_CLINIC_TIMEZONE
): number {
  return toZonedTime(date, timeZone).getDay();
}
