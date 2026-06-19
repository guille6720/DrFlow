import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { generateAvailableSlots } from "@/lib/booking/slots";
import { fromZonedTime } from "date-fns-tz";
import { DEFAULT_CLINIC_TIMEZONE } from "@/lib/utils/clinic-timezone";

describe("generateAvailableSlots", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-18T15:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // viernes 19 jun 2026 en Argentina
  const friday = fromZonedTime(
    new Date(2026, 5, 19, 0, 0, 0),
    DEFAULT_CLINIC_TIMEZONE
  );

  it("generates slots with hora Argentina en el label", () => {
    const slots = generateAvailableSlots({
      rules: [
        { day_of_week: 5, start_time: "15:00", end_time: "16:00", slot_duration: 30 },
      ],
      appointments: [],
      blocks: [],
      fromDate: friday,
      daysAhead: 1,
      timeZone: DEFAULT_CLINIC_TIMEZONE,
    });

    expect(slots.length).toBeGreaterThan(0);
    expect(slots[0].label).toContain("15:00");
    expect(slots[0].start_at).toBe("2026-06-19T18:00:00.000Z");
  });

  it("excludes occupied appointment slots", () => {
    const slots = generateAvailableSlots({
      rules: [
        { day_of_week: 5, start_time: "09:00", end_time: "10:00", slot_duration: 30 },
      ],
      appointments: [
        {
          start_at: "2026-06-19T12:00:00.000Z",
          end_at: "2026-06-19T12:30:00.000Z",
        },
      ],
      blocks: [],
      fromDate: friday,
      daysAhead: 1,
      timeZone: DEFAULT_CLINIC_TIMEZONE,
    });

    expect(slots.some((s) => s.start_at === "2026-06-19T12:00:00.000Z")).toBe(false);
    expect(slots.length).toBeGreaterThan(0);
  });
});
