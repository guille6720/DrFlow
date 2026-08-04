import { describe, expect, it } from "vitest";
import {
  formatPatientEhrSidebarDate,
  patientEhrEvolutionBody,
} from "@/features/historias/components/historias/patient-ehr-utils";
import type { PatientEhrConsultation } from "@/features/pacientes/utils/patient-ehr-model";

describe("patientEhrEvolutionBody", () => {
  it("returns evolution text when present", () => {
    const c = {
      evolution: "Paciente estable.",
      chief_complaint: "Control",
    } as PatientEhrConsultation;
    expect(patientEhrEvolutionBody(c)).toBe("Paciente estable.");
  });

  it("falls back to chief complaint when evolution is empty", () => {
    const c = {
      evolution: "",
      chief_complaint: "Dolor abdominal",
    } as PatientEhrConsultation;
    expect(patientEhrEvolutionBody(c)).toBe("Dolor abdominal");
  });

  it("returns placeholder for import markers without evolution", () => {
    const c = {
      evolution: "",
      chief_complaint: "[HCE: resumen.pdf]",
    } as PatientEhrConsultation;
    expect(patientEhrEvolutionBody(c)).toBe("Sin texto de evolución registrado.");
  });
});

describe("formatPatientEhrSidebarDate", () => {
  it("formats date as DD-MMM-YY", () => {
    expect(formatPatientEhrSidebarDate("2024-03-15T10:00:00Z")).toMatch(/^15-MAR-24$/);
  });
});
