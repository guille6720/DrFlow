import { addMonths, differenceInCalendarDays, endOfMonth, isAfter, isBefore, startOfDay, startOfMonth } from "date-fns";

/** Extra calendar months after the current month that staff can view and book. */
export const APPOINTMENT_HORIZON_EXTRA_MONTHS = 2;

export function getAppointmentHorizonMonthStart(from: Date = new Date()): Date {
  return startOfMonth(from);
}

export function getAppointmentHorizonEnd(from: Date = new Date()): Date {
  return endOfMonth(addMonths(startOfMonth(from), APPOINTMENT_HORIZON_EXTRA_MONTHS));
}

export function getAppointmentHorizonDaysAhead(from: Date = new Date()): number {
  return Math.max(1, differenceInCalendarDays(getAppointmentHorizonEnd(from), startOfDay(from)) + 1);
}

export function isMonthWithinAppointmentHorizon(monthDate: Date, from: Date = new Date()): boolean {
  const target = startOfMonth(monthDate).getTime();
  const min = getAppointmentHorizonMonthStart(from).getTime();
  const max = startOfMonth(getAppointmentHorizonEnd(from)).getTime();
  return target >= min && target <= max;
}

export function isDateWithinAppointmentHorizon(date: Date, from: Date = new Date()): boolean {
  const day = startOfDay(date);
  return !isBefore(day, startOfDay(from)) && !isAfter(day, getAppointmentHorizonEnd(from));
}

export function listAppointmentHorizonMonths(from: Date = new Date()): Date[] {
  const start = getAppointmentHorizonMonthStart(from);
  return Array.from({ length: APPOINTMENT_HORIZON_EXTRA_MONTHS + 1 }, (_, index) =>
    addMonths(start, index)
  );
}
