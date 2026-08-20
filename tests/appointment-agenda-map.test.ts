import { describe, expect, it } from "vitest";

import {
  normalizeBookingSource,
  normalizeCancelledByType,
  normalizeConsultationModality,
  toAppointmentAgendaRow,
} from "@/core/supabase/appointment-agenda-map";

describe("appointment agenda mapping", () => {
  it("accepts DB booking_source contract", () => {
    expect(normalizeBookingSource("manual")).toBe("manual");
    expect(normalizeBookingSource("online")).toBe("online");
    expect(normalizeBookingSource("api")).toBe("api");
    expect(normalizeBookingSource("webhook")).toBeNull();
    expect(normalizeBookingSource(null)).toBeNull();
  });

  it("normalizes related string columns", () => {
    expect(normalizeCancelledByType("patient")).toBe("patient");
    expect(normalizeCancelledByType("other")).toBeNull();
    expect(normalizeConsultationModality("virtual")).toBe("virtual");
    expect(normalizeConsultationModality("phone")).toBeNull();
  });

  it("maps a row without treating unknown source as valid", () => {
    const row = toAppointmentAgendaRow({
      id: "1",
      clinic_id: "c",
      patient_id: "p",
      professional_id: "pr",
      location_id: null,
      specialty_id: null,
      start_at: "2026-01-01T10:00:00Z",
      end_at: "2026-01-01T10:30:00Z",
      status: "confirmed",
      notes: null,
      booking_source: "legacy-portal",
      cancellation_reason: null,
      cancelled_at: null,
      cancelled_by: null,
      cancelled_by_type: "bot",
      consultation_modality: "phone",
    });
    expect(row.booking_source).toBeUndefined();
    expect(row.cancelled_by_type).toBeNull();
    expect(row.consultation_modality).toBeUndefined();
  });
});
