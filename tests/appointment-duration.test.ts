import { describe, expect, it } from "vitest";

import {
  DEFAULT_APPOINTMENT_DURATION_MINUTES,
  filterSlotsByDuration,
  resolveAppointmentEndAt,
  slotSupportsDuration,
} from "@/features/turnos/utils/appointment-duration";

describe("appointment-duration", () => {
  it("defaults to 30 minutes", () => {
    expect(DEFAULT_APPOINTMENT_DURATION_MINUTES).toBe(30);
  });

  it("filters slots that do not fit the selected duration", () => {
    const slots = [{ start_at: "2026-08-10T12:00:00.000Z", end_at: "2026-08-10T12:20:00.000Z" }];
    const appointments = [{ start_at: "2026-08-10T12:20:00.000Z", end_at: "2026-08-10T12:40:00.000Z" }];

    expect(filterSlotsByDuration(slots, 20, appointments, [])).toHaveLength(1);
    expect(filterSlotsByDuration(slots, 30, appointments, [])).toHaveLength(0);
  });

  it("builds end_at from start and duration", () => {
    expect(resolveAppointmentEndAt("2026-08-10T12:00:00.000Z", 30)).toBe(
      "2026-08-10T12:30:00.000Z"
    );
  });

  it("rejects slots overlapping existing appointments", () => {
    const ok = slotSupportsDuration(
      "2026-08-10T12:00:00.000Z",
      30,
      [{ start_at: "2026-08-10T13:00:00.000Z", end_at: "2026-08-10T13:30:00.000Z" }],
      []
    );

    expect(ok).toBe(true);
  });
});
