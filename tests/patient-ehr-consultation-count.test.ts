import { describe, expect, it } from "vitest";

import {
  countConsultationsFromHceRows,
  countEhrConsultations,
} from "@/features/pacientes/utils/patient-ehr-consultation-count";
import type { PatientEhrConsultation } from "@/features/pacientes/utils/patient-ehr-model";

import type { HceExportRow } from "@/lib/utils/hce-export-parse";

function consultation(
  partial: Partial<PatientEhrConsultation> & Pick<PatientEhrConsultation, "id" | "created_at">
): PatientEhrConsultation {
  return {
    professional_name: "Dr. Test",
    chief_complaint: "Control",
    diagnosis: "",
    evolution: "Evolución clínica con texto suficiente para listado.",
    indications: "",
    category: "evolution",
    ...partial,
  };
}

describe("countEhrConsultations", () => {
  it("counts each evolution separately, including several on the same day", () => {
    const count = countEhrConsultations([
      consultation({ id: "1", created_at: "2023-03-14T10:00:00Z" }),
      consultation({ id: "2", created_at: "2023-03-14T15:00:00Z" }),
      consultation({ id: "3", created_at: "2021-12-02T10:00:00Z" }),
    ]);

    expect(count).toBe(3);
  });

  it("does not count satellite rows on a day that already has an evolution", () => {
    const count = countEhrConsultations([
      consultation({ id: "1", created_at: "2023-03-14T10:00:00Z" }),
      consultation({ id: "2", created_at: "2023-03-14T10:05:00Z", category: "diagnostic" }),
      consultation({ id: "3", created_at: "2023-03-14T10:06:00Z", category: "vitals" }),
    ]);

    expect(count).toBe(1);
  });

  it("collapses satellite-only rows to one entry per day", () => {
    const count = countEhrConsultations([
      consultation({ id: "1", created_at: "2023-03-14T10:00:00Z", category: "diagnostic" }),
      consultation({ id: "2", created_at: "2023-03-14T11:00:00Z", category: "treatment" }),
      consultation({ id: "3", created_at: "2021-12-02T10:00:00Z", category: "document" }),
    ]);

    expect(count).toBe(2);
  });

  it("returns 0 for no records", () => {
    expect(countEhrConsultations([])).toBe(0);
  });
});

describe("countConsultationsFromHceRows", () => {
  it("counts imported evolution records as consultations", () => {
    const rows: HceExportRow[] = [
      {
        lineNumber: 1,
        paciente_id: "p1",
        last_name: "Amaya",
        first_name: "Rosa",
        document_number: "123",
        tipo_registro: "records",
        fecha_inicio: "2023-03-14",
        fecha_fin: null,
        estado: "",
        diagnostico: "Control",
        cie10: "",
        notas: "Evolución importada desde HCE con texto clínico.",
      },
      {
        lineNumber: 2,
        paciente_id: "p1",
        last_name: "Amaya",
        first_name: "Rosa",
        document_number: "123",
        tipo_registro: "records",
        fecha_inicio: "2021-12-02",
        fecha_fin: null,
        estado: "",
        diagnostico: "Control",
        cie10: "",
        notas: "Segunda evolución importada.",
      },
    ];

    expect(countConsultationsFromHceRows(rows)).toBe(2);
  });
});
