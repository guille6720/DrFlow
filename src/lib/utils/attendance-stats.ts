import {
  addMonths,
  endOfMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { formatInTimeZone } from "date-fns-tz";
import { es } from "date-fns/locale";
import type { ConsultationModality } from "@/lib/constants/consultation-modality";
import { DEFAULT_CLINIC_TIMEZONE } from "@/lib/utils/clinic-timezone";

export type AttendancePeriod = "daily" | "weekly" | "monthly";

export interface AttendedAppointmentRow {
  id: string;
  start_at: string;
  consultation_modality: ConsultationModality | null;
  patient_id: string;
  patients?: { first_name: string; last_name: string } | null;
  professionals?: { profiles?: { full_name?: string } | null } | null;
}

export interface AttendanceSummary {
  total: number;
  presencial: number;
  virtual: number;
  uniquePatients: number;
}

export function getAttendancePeriodBounds(
  period: AttendancePeriod,
  referenceDate: Date = new Date(),
  timeZone: string = DEFAULT_CLINIC_TIMEZONE
): { start: Date; end: Date; label: string } {
  const zoned = toZonedTime(referenceDate, timeZone);

  if (period === "daily") {
    const startLocal = new Date(
      zoned.getFullYear(),
      zoned.getMonth(),
      zoned.getDate(),
      0,
      0,
      0,
      0
    );
    const endLocal = new Date(
      zoned.getFullYear(),
      zoned.getMonth(),
      zoned.getDate() + 1,
      0,
      0,
      0,
      0
    );
    return {
      start: fromZonedTime(startLocal, timeZone),
      end: fromZonedTime(endLocal, timeZone),
      label: formatInTimeZone(referenceDate, timeZone, "PPP", { locale: es }),
    };
  }

  if (period === "weekly") {
    const weekStartLocal = startOfWeek(zoned, { weekStartsOn: 1 });
    const startLocal = new Date(
      weekStartLocal.getFullYear(),
      weekStartLocal.getMonth(),
      weekStartLocal.getDate(),
      0,
      0,
      0,
      0
    );
    const endLocal = new Date(
      weekStartLocal.getFullYear(),
      weekStartLocal.getMonth(),
      weekStartLocal.getDate() + 7,
      0,
      0,
      0,
      0
    );
    const endDisplay = new Date(
      weekStartLocal.getFullYear(),
      weekStartLocal.getMonth(),
      weekStartLocal.getDate() + 6,
      0,
      0,
      0,
      0
    );
    return {
      start: fromZonedTime(startLocal, timeZone),
      end: fromZonedTime(endLocal, timeZone),
      label: `${formatInTimeZone(fromZonedTime(startLocal, timeZone), timeZone, "d MMM", { locale: es })} – ${formatInTimeZone(fromZonedTime(endDisplay, timeZone), timeZone, "d MMM yyyy", { locale: es })}`,
    };
  }

  const monthStartLocal = startOfMonth(zoned);
  const monthEndLocal = endOfMonth(zoned);
  const nextMonthStart = addMonths(monthStartLocal, 1);
  const startLocal = new Date(
    monthStartLocal.getFullYear(),
    monthStartLocal.getMonth(),
    monthStartLocal.getDate(),
    0,
    0,
    0,
    0
  );
  const endLocal = new Date(
    nextMonthStart.getFullYear(),
    nextMonthStart.getMonth(),
    nextMonthStart.getDate(),
    0,
    0,
    0,
    0
  );
  return {
    start: fromZonedTime(startLocal, timeZone),
    end: fromZonedTime(endLocal, timeZone),
    label: formatInTimeZone(fromZonedTime(monthEndLocal, timeZone), timeZone, "MMMM yyyy", {
      locale: es,
    }),
  };
}

export function summarizeAttendedAppointments(
  rows: AttendedAppointmentRow[]
): AttendanceSummary {
  let presencial = 0;
  let virtual = 0;
  const patientIds = new Set<string>();

  for (const row of rows) {
    patientIds.add(row.patient_id);
    if (row.consultation_modality === "virtual") virtual += 1;
    else presencial += 1;
  }

  return {
    total: rows.length,
    presencial,
    virtual,
    uniquePatients: patientIds.size,
  };
}
