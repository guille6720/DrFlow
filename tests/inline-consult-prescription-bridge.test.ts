import { beforeEach, describe, expect, it } from "vitest";

import {
  clearInlineConsultPrescriptionSnapshot,
  inlineConsultPrescriptionKey,
  readInlineConsultPrescriptionSnapshot,
  saveInlineConsultPrescriptionSnapshot,
} from "@/features/recetas/utils/inline-consult-prescription-bridge";

describe("inline-consult-prescription-bridge", () => {
  const patientId = "550e8400-e29b-41d4-a716-446655440000";
  const appointmentId = "660e8400-e29b-41d4-a716-446655440001";

  beforeEach(() => {
    sessionStorage.clear();
  });

  it("uses appointment-scoped key when appointmentId is present", () => {
    expect(inlineConsultPrescriptionKey(patientId, appointmentId)).toBe(
      `drflow-inline-rx-appt-${appointmentId}`
    );
    expect(inlineConsultPrescriptionKey(patientId)).toBe(`drflow-inline-rx-patient-${patientId}`);
  });

  it("stores and reads snapshot for inline consult prefill", () => {
    saveInlineConsultPrescriptionSnapshot({
      patientId,
      appointmentId,
      diagnosis: "Hipertensión arterial",
      indications: "Control en 30 días",
      evolution: "Paciente estable",
      savedAt: "2026-08-11T12:00:00.000Z",
    });

    const snapshot = readInlineConsultPrescriptionSnapshot(patientId, appointmentId);
    expect(snapshot?.diagnosis).toBe("Hipertensión arterial");
    expect(snapshot?.indications).toBe("Control en 30 días");
    expect(snapshot?.evolution).toBe("Paciente estable");
  });

  it("rejects snapshot when patientId does not match", () => {
    saveInlineConsultPrescriptionSnapshot({
      patientId,
      diagnosis: "Test",
      indications: "",
      evolution: "",
      savedAt: "2026-08-11T12:00:00.000Z",
    });

    expect(readInlineConsultPrescriptionSnapshot("other-patient")).toBeNull();
  });

  it("clears snapshot", () => {
    saveInlineConsultPrescriptionSnapshot({
      patientId,
      diagnosis: "Test",
      indications: "",
      evolution: "",
      savedAt: "2026-08-11T12:00:00.000Z",
    });

    clearInlineConsultPrescriptionSnapshot(patientId);
    expect(readInlineConsultPrescriptionSnapshot(patientId)).toBeNull();
  });
});
