import { addMonths, differenceInCalendarDays, endOfMonth, startOfDay, startOfMonth } from "date-fns";
import { describe, expect, it } from "vitest";

import {
  APPOINTMENT_HORIZON_EXTRA_MONTHS,
  APPOINTMENT_HORIZON_MONTHS,
  getAppointmentHorizonDaysAhead,
  getAppointmentHorizonEnd,
  isDateWithinAppointmentHorizon,
  isMonthWithinAppointmentHorizon,
  listAppointmentHorizonMonths,
} from "@/lib/utils/appointment-booking-horizon";

describe("appointment-booking-horizon", () => {
  const from = new Date(2026, 7, 11);

  it("ends at the last day of the twelfth bookable month", () => {
    const end = getAppointmentHorizonEnd(from);
    expect(end.getFullYear()).toBe(2027);
    expect(end.getMonth()).toBe(6);
    expect(end.getDate()).toBe(31);
    expect(end.getTime()).toBe(
      endOfMonth(addMonths(startOfMonth(from), APPOINTMENT_HORIZON_EXTRA_MONTHS)).getTime()
    );
  });

  it("covers remaining current month plus eleven extra months in daysAhead", () => {
    const expectedDays =
      differenceInCalendarDays(getAppointmentHorizonEnd(from), startOfDay(from)) + 1;
    expect(getAppointmentHorizonDaysAhead(from)).toBe(expectedDays);
    expect(APPOINTMENT_HORIZON_MONTHS).toBe(12);
    expect(APPOINTMENT_HORIZON_EXTRA_MONTHS).toBe(11);
  });

  it("lists twelve bookable months including December of the current year", () => {
    const months = listAppointmentHorizonMonths(from);
    expect(months).toHaveLength(12);
    expect(months.map((d) => d.getMonth())).toEqual([7, 8, 9, 10, 11, 0, 1, 2, 3, 4, 5, 6]);
    expect(months[4].getFullYear()).toBe(2026);
    expect(months[4].getMonth()).toBe(11);
  });

  it("accepts dates inside the horizon and rejects dates after it", () => {
    expect(isDateWithinAppointmentHorizon(new Date(2026, 11, 31), from)).toBe(true);
    expect(isDateWithinAppointmentHorizon(new Date(2027, 6, 31), from)).toBe(true);
    expect(isDateWithinAppointmentHorizon(new Date(2027, 7, 1), from)).toBe(false);
    expect(isMonthWithinAppointmentHorizon(new Date(2026, 11, 1), from)).toBe(true);
    expect(isMonthWithinAppointmentHorizon(new Date(2027, 6, 1), from)).toBe(true);
    expect(isMonthWithinAppointmentHorizon(new Date(2027, 7, 1), from)).toBe(false);
  });
});
