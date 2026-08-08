import { describe, expect, it } from "vitest";

import {
  formatPatientConsultationCount,
  formatPatientConsultationCountShort,
} from "@/features/pacientes/utils/patient-consultation-count";

describe("formatPatientConsultationCount", () => {
  it("formats zero, one and many consultations", () => {
    expect(formatPatientConsultationCount(0)).toBe("Sin consultas registradas");
    expect(formatPatientConsultationCount(1)).toBe("1 consulta realizada");
    expect(formatPatientConsultationCount(5)).toBe("5 consultas realizadas");
  });
});

describe("formatPatientConsultationCountShort", () => {
  it("formats compact labels for list rows", () => {
    expect(formatPatientConsultationCountShort(0)).toBe("Sin consultas");
    expect(formatPatientConsultationCountShort(1)).toBe("1 consulta");
    expect(formatPatientConsultationCountShort(12)).toBe("12 consultas");
  });
});
