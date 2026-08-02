import { describe, expect, it } from "vitest";
import { looksLikeMedication } from "@/lib/utils/ehr-clinical-category";
import { buildEhrPayloadFromHceRows } from "@/lib/utils/patient-ehr-from-hce";
import { buildEhrPayloadFromRecords, sanitizeEhrPayload } from "@/lib/utils/patient-ehr-model";
import type { HceExportRow } from "@/lib/utils/hce-export-parse";

describe("looksLikeMedication", () => {
  it("detects prescribed drugs", () => {
    expect(looksLikeMedication("Metformina - DBI AP 500 - 500mg Comp. Rec. x 60")).toBe(true);
    expect(looksLikeMedication("Rosuvastatina - ARTMEY - 10mg Comp. x 30")).toBe(true);
    expect(looksLikeMedication("Omeprazol - ULCOZOL - 20mg Caps. x 30")).toBe(true);
    expect(looksLikeMedication("GASTEC 20mg")).toBe(true);
  });

  it("does not classify clinical diagnoses as medication", () => {
    expect(looksLikeMedication("Otitis externa, no especificada")).toBe(false);
    expect(looksLikeMedication("Artrosis, no especificada")).toBe(false);
    expect(
      looksLikeMedication("Diabetes mellitus insulinodependiente, sin mención de complicación")
    ).toBe(false);
    expect(
      looksLikeMedication("Infarto transmural agudo del miocardio de la pared anterior CIE-10: I210")
    ).toBe(false);
  });
});

describe("sanitizeEhrPayload", () => {
  it("moves misclassified drugs from diagnostics to treatments", () => {
    const result = sanitizeEhrPayload({
      consultations: [],
      diagnosisRows: [
        {
          id: "d1",
          dateLabel: "10-NOV-22",
          name: "Metformina - DBI AP 500 - 500mg Comp. Rec. x 60",
          chronic: true,
          recordId: "hce-1",
        },
        {
          id: "d2",
          dateLabel: "10-NOV-22",
          name: "Artrosis, no especificada",
          chronic: true,
          recordId: "hce-2",
        },
      ],
      treatmentRows: [],
    });

    expect(result.diagnosisRows).toHaveLength(1);
    expect(result.diagnosisRows[0].name).toBe("Artrosis, no especificada");
    expect(result.treatmentRows).toHaveLength(1);
    expect(result.treatmentRows[0].product).toContain("Metformina");
  });
});

describe("buildEhrPayloadFromHceRows medication reclassification", () => {
  it("routes drugs mislabeled as diagnostics into treatments", () => {
    const rows: HceExportRow[] = [
      {
        lineNumber: 2,
        paciente_id: "summary",
        last_name: "",
        first_name: "",
        document_number: null,
        tipo_registro: "diagnostics",
        fecha_inicio: "2022-11-10",
        fecha_fin: null,
        estado: "chronic",
        diagnostico: "Metformina - DBI AP 500 - 500mg Comp. Rec. x 60",
        cie10: "",
        notas: "",
      },
      {
        lineNumber: 3,
        paciente_id: "summary",
        last_name: "",
        first_name: "",
        document_number: null,
        tipo_registro: "diagnostics",
        fecha_inicio: "2022-11-10",
        fecha_fin: null,
        estado: "chronic",
        diagnostico: "Artrosis, no especificada",
        cie10: "M199",
        notas: "",
      },
    ];

    const { diagnosisRows, treatmentRows } = buildEhrPayloadFromHceRows(rows, "Dr. Test");

    expect(diagnosisRows).toHaveLength(1);
    expect(diagnosisRows[0].name).toContain("Artrosis");
    expect(treatmentRows).toHaveLength(1);
    expect(treatmentRows[0].product).toContain("Metformina");
  });
});

describe("buildEhrPayloadFromRecords medication reclassification", () => {
  it("does not put drug names from diagnosis field into diagnostics table", () => {
    const { diagnosisRows, treatmentRows } = buildEhrPayloadFromRecords([
      {
        id: "1",
        created_at: "2022-11-10T12:00:00.000Z",
        chief_complaint: "[HCE:x:diagnostics:2022-11-10:1] Diagnóstico importado (chronic)",
        diagnosis: "Rosuvastatina - ARTMEY - 10mg Comp. x 30",
        evolution: "",
        indications: "",
        professional_name: "Dr. Test",
      },
      {
        id: "2",
        created_at: "2022-11-10T12:00:00.000Z",
        chief_complaint: "[HCE:x:diagnostics:2022-11-10:2] Diagnóstico importado (chronic)",
        diagnosis: "Diabetes mellitus insulinodependiente, sin mención de complicación",
        evolution: "",
        indications: "",
        professional_name: "Dr. Test",
      },
    ]);

    expect(diagnosisRows).toHaveLength(1);
    expect(diagnosisRows[0].name).toContain("Diabetes");
    expect(treatmentRows).toHaveLength(1);
    expect(treatmentRows[0].product).toContain("Rosuvastatina");
  });
});
