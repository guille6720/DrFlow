import { describe, it, expect } from "vitest";
import { generateAvailableSlots } from "@/lib/booking/slots";
import { addDays, nextMonday, setHours, setMinutes, startOfDay } from "date-fns";

describe("generateAvailableSlots", () => {
  const monday = startOfDay(nextMonday(new Date()));

  it("generates slots from availability rules", () => {
    const slots = generateAvailableSlots({
      rules: [
        { day_of_week: 1, start_time: "09:00", end_time: "10:00", slot_duration: 30 },
      ],
      appointments: [],
      blocks: [],
      fromDate: monday,
      daysAhead: 7,
    });

    expect(slots.length).toBeGreaterThan(0);
    expect(slots[0].label).toContain("09:00");
  });

  it("excludes occupied appointment slots", () => {
    const slotStart = addDays(monday, 0);
    const at9 = setMinutes(setHours(slotStart, 9), 0);

    const slots = generateAvailableSlots({
      rules: [
        { day_of_week: 1, start_time: "09:00", end_time: "10:00", slot_duration: 30 },
      ],
      appointments: [
        {
          start_at: at9.toISOString(),
          end_at: setMinutes(setHours(slotStart, 9), 30).toISOString(),
        },
      ],
      blocks: [],
      fromDate: monday,
      daysAhead: 1,
    });

    const has9am = slots.some((s) => s.start_at === at9.toISOString());
    expect(has9am).toBe(false);
  });
});
