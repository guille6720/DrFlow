import { describe, it, expect } from "vitest";
import { appointmentSchema, patientSchema, sanitizeText } from "@/lib/validations/schemas";

describe("Validation schemas", () => {
  it("validates patient required fields", () => {
    const result = patientSchema.safeParse({
      first_name: "María",
      last_name: "González",
      document_number: "30123456",
    });
    expect(result.success).toBe(true);
  });

  it("rejects appointment with end before start", () => {
    const result = appointmentSchema.safeParse({
      patient_id: "a0000000-0000-4000-8000-000000000001",
      professional_id: "a0000000-0000-4000-8000-000000000002",
      start_at: "2026-06-15T14:00:00.000Z",
      end_at: "2026-06-15T13:00:00.000Z",
      status: "pending",
    });
    expect(result.success).toBe(false);
  });

  it("sanitizes HTML-like characters", () => {
    expect(sanitizeText("<script>alert(1)</script>")).not.toContain("<");
  });
});
