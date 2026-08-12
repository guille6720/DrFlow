import { addMonths, endOfMonth, startOfMonth } from "date-fns";
import { describe, expect, it } from "vitest";

import {
  APPOINTMENT_HORIZON_EXTRA_MONTHS,
  getAppointmentHorizonDaysAhead,
  getAppointmentHorizonEnd,
  isDateWithinAppointmentHorizon,
  isMonthWithinAppointmentHorizon,
  listAppointmentHorizonMonths,
} from "@/lib/utils/appointment-booking-horizon";

describe("appointment-booking-horizon", () => {
  const from = new Date(2026, 7, 11);

  it("ends at the last day of current month plus two extra months", () => {
    const end = getAppointmentHorizonEnd(from);
    expect(end.getFullYear()).toBe(2026);
    expect(end.getMonth()).toBe(9);
    expect(end.getDate()).toBe(31);
    expect(end.getTime()).toBe(endOfMonth(addMonths(startOfMonth(from), 2)).getTime());
  });

  it("covers remaining current month plus two extra months in daysAhead", () => {
    expect(getAppointmentHorizonDaysAhead(from)).toBe(82);
    expect(APPOINTMENT_HORIZON_EXTRA_MONTHS).toBe(2);
  });

  it("lists the three bookable months", () => {
    const months = listAppointmentHorizonMonths(from);
    expect(months.map((d) => d.getMonth())).toEqual([7, 8, 9]);
  });

  it("accepts dates inside the horizon and rejects dates after it", () => {
    expect(isDateWithinAppointmentHorizon(new Date(2026, 9, 31), from)).toBe(true);
    expect(isDateWithinAppointmentHorizon(new Date(2026, 10, 1), from)).toBe(false);
    expect(isMonthWithinAppointmentHorizon(new Date(2026, 9, 1), from)).toBe(true);
    expect(isMonthWithinAppointmentHorizon(new Date(2026, 10, 1), from)).toBe(false);
  });
});
