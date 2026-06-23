import { describe, it, expect } from "vitest";
import {
  getAttendancePeriodBounds,
  summarizeAttendedAppointments,
} from "@/lib/utils/attendance-stats";

describe("attendance stats", () => {
  it("summarizes presencial and virtual counts", () => {
    const summary = summarizeAttendedAppointments([
      {
        id: "1",
        start_at: "2026-06-16T15:00:00Z",
        consultation_modality: "presencial",
        patient_id: "p1",
      },
      {
        id: "2",
        start_at: "2026-06-16T16:00:00Z",
        consultation_modality: "virtual",
        patient_id: "p1",
      },
      {
        id: "3",
        start_at: "2026-06-16T17:00:00Z",
        consultation_modality: "virtual",
        patient_id: "p2",
      },
    ]);

    expect(summary.total).toBe(3);
    expect(summary.presencial).toBe(1);
    expect(summary.virtual).toBe(2);
    expect(summary.uniquePatients).toBe(2);
  });

  it("builds daily period bounds", () => {
    const ref = new Date("2026-06-16T15:00:00Z");
    const { start, end } = getAttendancePeriodBounds("daily", ref);
    expect(end.getTime()).toBeGreaterThan(start.getTime());
  });
});
