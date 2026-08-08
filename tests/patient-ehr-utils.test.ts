import { describe, expect, it } from "vitest";

import {
  buildConsultationSidebarList,
  filterClinicalRowsByConsultationDay,
  formatPatientEhrSidebarDate,
  patientEhrEvolutionBody,
  resolveSelectedConsultation,
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

function consultation(
  partial: Partial<PatientEhrConsultation> & Pick<PatientEhrConsultation, "id" | "created_at">
): PatientEhrConsultation {
  return {
    professional_name: "Dr. Test",
    chief_complaint: "",
    diagnosis: "",
    evolution: "",
    indications: "",
    category: "evolution",
    ...partial,
  };
}

describe("buildConsultationSidebarList", () => {
  it("deduplicates same-day records and keeps only evolution consultations", () => {
    const sorted = [
      consultation({ id: "1", created_at: "2022-11-10T12:00:00Z", category: "evolution" }),
      consultation({ id: "2", created_at: "2022-11-10T15:00:00Z", category: "diagnostic" }),
      consultation({ id: "3", created_at: "2022-11-10T18:00:00Z", category: "treatment" }),
      consultation({ id: "4", created_at: "2022-11-09T10:00:00Z", category: "evolution" }),
    ];

    const sidebar = buildConsultationSidebarList(sorted, sorted);

    expect(sidebar.map((c) => c.id)).toEqual(["1", "4"]);
  });
});

describe("resolveSelectedConsultation", () => {
  it("returns the requested consultation instead of falling back to the first item", () => {
    const sidebar = [
      consultation({ id: "newest", created_at: "2022-11-10T12:00:00Z" }),
      consultation({ id: "older", created_at: "2022-11-09T10:00:00Z" }),
    ];

    const selected = resolveSelectedConsultation("older", sidebar, sidebar, sidebar);

    expect(selected?.id).toBe("older");
  });
});

describe("filterClinicalRowsByConsultationDay", () => {
  it("keeps only rows from the selected consultation day", () => {
    const rows = [
      { id: "a", recordCreatedAt: "2019-04-05T12:00:00Z" },
      { id: "b", recordCreatedAt: "2018-12-24T12:00:00Z" },
    ];

    const filtered = filterClinicalRowsByConsultationDay(rows, "2019-04-05T09:00:00Z");

    expect(filtered.map((row) => row.id)).toEqual(["a"]);
  });
});
