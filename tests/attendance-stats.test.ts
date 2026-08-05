import { describe, expect, it } from "vitest";

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
    expect(summary.byCoverage).toEqual([{ coverage: "Sin cobertura", count: 3 }]);
  });

  it("groups by insurance coverage", () => {
    const summary = summarizeAttendedAppointments([
      {
        id: "1",
        start_at: "2026-06-16T15:00:00Z",
        consultation_modality: "presencial",
        patient_id: "p1",
        patients: { first_name: "A", last_name: "B", insurance_provider: "PAMI" },
      },
      {
        id: "2",
        start_at: "2026-06-16T16:00:00Z",
        consultation_modality: "virtual",
        patient_id: "p2",
        patients: { first_name: "C", last_name: "D", insurance_provider: "OSDE" },
      },
      {
        id: "3",
        start_at: "2026-06-16T17:00:00Z",
        consultation_modality: "presencial",
        patient_id: "p3",
        patients: { first_name: "E", last_name: "F", insurance_provider: "PAMI" },
      },
    ]);

    expect(summary.byCoverage).toEqual([
      { coverage: "PAMI", count: 2 },
      { coverage: "OSDE", count: 1 },
    ]);
  });

  it("builds daily period bounds", () => {
    const ref = new Date("2026-06-16T15:00:00Z");
    const { start, end } = getAttendancePeriodBounds("daily", ref);
    expect(end.getTime()).toBeGreaterThan(start.getTime());
  });
});
