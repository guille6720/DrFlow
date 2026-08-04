import { describe, expect, it } from "vitest";
import {
  entityIdSchema,
  parseEntityId,
  searchQuerySchema,
} from "@/core/validations/params";
import {
  publicBookingCancelSchema,
  publicBookingStatusesSchema,
} from "@/core/validations/public-booking";
import { pharmacologyApiQuerySchema } from "@/core/validations/pharmacology-api";
import { medicalOrderFormSchema } from "@/core/validations/medical-order";
import { mockPaymentSchema } from "@/core/validations/cash-schemas";
import { clinicalIndicatorsSchema } from "@/core/validations/clinical-indicators";
import { validateClinicJobEnqueue } from "@/core/validations/clinic-jobs";
import { safeRedirectPathSchema } from "@/core/validations/auth-redirect";
import { clinicSettingsSchema } from "@/core/validations/settings-schemas";

describe("input validation params", () => {
  it("rejects non-uuid entity ids", () => {
    expect(parseEntityId("not-a-uuid").ok).toBe(false);
    expect(parseEntityId("550e8400-e29b-41d4-a716-446655440000").ok).toBe(true);
  });

  it("validates public booking cancel payload", () => {
    const ok = publicBookingCancelSchema.safeParse({
      slug: "demo-clinic",
      document_number: "12345678",
      appointment_id: "550e8400-e29b-41d4-a716-446655440000",
      reason: "No puedo asistir",
    });
    expect(ok.success).toBe(true);
  });

  it("validates appointment id arrays for portal status", () => {
    const bad = publicBookingStatusesSchema.safeParse({
      slug: "demo",
      document_number: "12345678",
      appointment_ids: ["x"],
    });
    expect(bad.success).toBe(false);
  });

  it("validates pharmacology API query modes", () => {
    const q = pharmacologyApiQuerySchema.safeParse({ q: "diabetes" });
    expect(q.success).toBe(true);

    const conflict = pharmacologyApiQuerySchema.safeParse({
      q: "diabetes",
      pathologyId: entityIdSchema.parse("550e8400-e29b-41d4-a716-446655440000"),
    });
    expect(conflict.success).toBe(false);
  });

  it("validates medical order UUID fields", () => {
    const bad = medicalOrderFormSchema.safeParse({
      patient_id: "x",
      professional_id: "550e8400-e29b-41d4-a716-446655440001",
      order_text: "Rx",
      order_type: "study",
    });
    expect(bad.success).toBe(false);
  });

  it("validates mock payment amounts", () => {
    const bad = mockPaymentSchema.safeParse({
      patient_id: "550e8400-e29b-41d4-a716-446655440000",
      amount: -1,
    });
    expect(bad.success).toBe(false);
  });

  it("validates clinical indicators numeric bounds", () => {
    const bad = clinicalIndicatorsSchema.safeParse({ weightKg: 9999 });
    expect(bad.success).toBe(false);
  });

  it("validates clinic job enqueue payload", () => {
    const bad = validateClinicJobEnqueue("run_ai_task", { task: "x", patientId: "bad" });
    expect(bad.ok).toBe(false);
  });

  it("blocks open redirect paths", () => {
    expect(safeRedirectPathSchema.safeParse("//evil.com").success).toBe(false);
    expect(safeRedirectPathSchema.safeParse("/dashboard").success).toBe(true);
  });

  it("bounds search queries", () => {
    expect(searchQuerySchema.safeParse("a").success).toBe(false);
    expect(searchQuerySchema.safeParse("diabetes").success).toBe(true);
  });

  it("validates clinic settings", () => {
    const ok = clinicSettingsSchema.safeParse({
      name: "Clínica Demo",
      phone: null,
      email: null,
      address: null,
      default_appointment_duration: 30,
      voice_input_enabled: false,
    });
    expect(ok.success).toBe(true);
  });
});
