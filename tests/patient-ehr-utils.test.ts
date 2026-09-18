import { describe, expect, it } from "vitest";

import {
  buildConsultationSidebarList,
  filterClinicalRowsByConsultationDay,
  filterConsultationsByConsultationDay,
  formatPatientEhrSidebarDate,
  patientEhrEvolutionBody,
  resolveConsultationAttachment,
  resolveDayPrintAnchorIso,
  resolveDayPrintConsultations,
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
  it("deduplicates same-day records across all categories", () => {
    const sorted = [
      consultation({ id: "1", created_at: "2022-11-10T12:00:00Z", category: "evolution" }),
      consultation({ id: "2", created_at: "2022-11-10T15:00:00Z", category: "diagnostic" }),
      consultation({ id: "3", created_at: "2022-11-10T18:00:00Z", category: "treatment" }),
      consultation({ id: "4", created_at: "2022-11-09T10:00:00Z", category: "evolution" }),
    ];

    const sidebar = buildConsultationSidebarList(sorted, sorted);

    expect(sidebar.map((c) => c.id)).toEqual(["1", "4"]);
  });

  it("keeps diagnostic-only days so HC is not blank", () => {
    const sorted = [
      consultation({ id: "d1", created_at: "2022-11-10T12:00:00Z", category: "diagnostic" }),
      consultation({ id: "t1", created_at: "2022-11-09T10:00:00Z", category: "treatment" }),
    ];

    const sidebar = buildConsultationSidebarList(sorted, []);

    expect(sidebar.map((c) => c.id)).toEqual(["d1", "t1"]);
  });

  it("shows every evolution even when multiple visits share the same day", () => {
    const sorted = [
      consultation({ id: "evo-late", created_at: "2022-11-10T18:00:00Z", category: "evolution" }),
      consultation({ id: "evo-early", created_at: "2022-11-10T09:00:00Z", category: "evolution" }),
      consultation({ id: "older", created_at: "2022-11-09T10:00:00Z", category: "evolution" }),
    ];

    const sidebar = buildConsultationSidebarList(sorted, sorted);

    expect(sidebar.map((c) => c.id)).toEqual(["evo-late", "evo-early", "older"]);
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

describe("filterConsultationsByConsultationDay", () => {
  it("keeps only vitals from the selected consultation day", () => {
    const rows = [
      {
        id: "v1",
        created_at: "2021-03-08T12:00:00Z",
        professional_name: "Dr. Test",
        chief_complaint: "Signos vitales",
        diagnosis: "",
        evolution: "TA 120/80",
        indications: "",
        category: "vitals" as const,
      },
      {
        id: "v2",
        created_at: "2025-08-29T12:00:00Z",
        professional_name: "Dr. Test",
        chief_complaint: "Signos vitales",
        diagnosis: "",
        evolution: "TA 170/70",
        indications: "",
        category: "vitals" as const,
      },
    ];

    const filtered = filterConsultationsByConsultationDay(rows, "2021-03-08T09:00:00Z");

    expect(filtered.map((row) => row.id)).toEqual(["v1"]);
  });
});

describe("resolveConsultationAttachment", () => {
  const consultation = (
    partial: Partial<PatientEhrConsultation> & Pick<PatientEhrConsultation, "id">
  ): PatientEhrConsultation => ({
    id: partial.id,
    created_at: partial.created_at ?? "2025-04-24T12:00:00Z",
    professional_name: "Dr. Test",
    chief_complaint: partial.chief_complaint ?? "",
    diagnosis: partial.diagnosis ?? "",
    evolution: partial.evolution ?? "",
    indications: "",
    category: partial.category ?? "document",
  });

  it("matches attachments by file name and embedded uuid", () => {
    const attachments = [
      {
        id: "att-1",
        file_name: "d8aded1d-2b82-4068-930b-b86427cdfcae.jpeg",
        created_at: "2025-04-24T12:00:00Z",
        category: "estudio",
      },
    ];

    const match = resolveConsultationAttachment(
      consultation({
        id: "rec-1",
        diagnosis: "d8aded1d-2b82-4068-930b-b86427cdfcae.jpeg",
      }),
      attachments
    );

    expect(match?.id).toBe("att-1");
  });
});

describe("resolveDayPrintAnchorIso", () => {
  const today = "2026-09-01T15:00:00.000Z";
  const yesterday = "2026-08-31T15:00:00.000Z";
  const list: PatientEhrConsultation[] = [
    {
      id: "new-today",
      created_at: today,
      professional_name: "Dr. A",
      chief_complaint: "",
      diagnosis: "",
      evolution: "Hoy",
      indications: "",
      category: "evolution",
    },
    {
      id: "old-yesterday",
      created_at: yesterday,
      professional_name: "Dr. A",
      chief_complaint: "",
      diagnosis: "",
      evolution: "Ayer",
      indications: "",
      category: "evolution",
    },
  ];

  it("prefers explicit day print anchor over selected consultation", () => {
    expect(
      resolveDayPrintAnchorIso({
        dayPrintAnchorIso: today,
        activeRecordId: null,
        evolutionList: list,
        selected: list[1],
      })
    ).toBe(today);
  });

  it("uses active in-progress record when anchor not set", () => {
    expect(
      resolveDayPrintAnchorIso({
        dayPrintAnchorIso: null,
        activeRecordId: "new-today",
        evolutionList: list,
        selected: list[1],
      })
    ).toBe(today);
  });

  it("filters day print consultations by anchor day", () => {
    const anchor = resolveDayPrintAnchorIso({
      dayPrintAnchorIso: today,
      activeRecordId: "new-today",
      evolutionList: list,
      selected: list[1],
    });
    const dayRows = resolveDayPrintConsultations(list, anchor);
    expect(dayRows.map((row) => row.id)).toEqual(["new-today"]);
  });
});
