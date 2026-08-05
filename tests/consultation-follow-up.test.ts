import { describe, expect, it } from "vitest";

import {
  buildFollowUpAppointmentFormData,
  CONSULTATION_FOLLOW_UP_DEFAULT_DURATION,
  defaultFollowUpStartAt,
  validateFollowUpProfessional,
} from "@/lib/utils/consultation-follow-up";

describe("consultation-follow-up", () => {
  it("defaults follow-up ~30 days ahead at 09:00 local", () => {
    const from = new Date("2026-08-04T12:00:00");
    const startAt = defaultFollowUpStartAt(from);
    expect(startAt).toMatch(/^2026-09-/);
    expect(startAt).toContain("T09:00");
  });

  it("requires a professional id", () => {
    expect(validateFollowUpProfessional(undefined)).toMatch(/profesional/i);
    expect(validateFollowUpProfessional("pro-1")).toBeNull();
  });

  it("builds form data for createAppointment", () => {
    const formData = buildFollowUpAppointmentFormData({
      patientId: "pat-1",
      professionalId: "pro-1",
      startAt: "2026-09-04T09:00",
      notes: "Control",
    });
    expect(formData.get("patient_id")).toBe("pat-1");
    expect(formData.get("professional_id")).toBe("pro-1");
    expect(formData.get("status")).toBe("pending");
    expect(formData.get("duration")).toBe(String(CONSULTATION_FOLLOW_UP_DEFAULT_DURATION));
    expect(formData.get("notes")).toBe("Control");
    expect(formData.get("end_at")).toBeTruthy();
  });
});
