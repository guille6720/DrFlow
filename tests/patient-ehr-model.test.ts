import { describe, expect, it } from "vitest";

import { buildEhrPayloadFromRecords } from "@/features/pacientes/utils/patient-ehr-model";

describe("buildEhrPayloadFromRecords", () => {
  it("uses diagnosis TEXT snapshot without parsing indications into treatments", () => {
    const { consultations, diagnosisRows, treatmentRows } = buildEhrPayloadFromRecords([
      {
        id: "1",
        created_at: "2022-11-10T12:00:00.000Z",
        chief_complaint: "Consulta",
        diagnosis: "Infarto transmural",
        evolution: "Paciente estable",
        indications: "GASTEC 20mg\nFILTEN 50mg",
        professional_name: "Dr. Test",
      },
    ]);
    expect(consultations).toHaveLength(1);
    expect(consultations[0].indications).toContain("GASTEC");
    expect(diagnosisRows).toHaveLength(1);
    expect(diagnosisRows[0].recordCreatedAt).toBe("2022-11-10T12:00:00.000Z");
    // Phase 3: no treatment rows invented from free-text indications.
    expect(treatmentRows).toHaveLength(0);
  });

  it("builds diagnosis rows from structured entries with CIE-10 and dedupes repeats", () => {
    const base = {
      chief_complaint: "Consulta",
      diagnosis: "HTA",
      evolution: "Estable",
      indications: "",
      professional_name: "Dr. Test",
    };
    const { diagnosisRows } = buildEhrPayloadFromRecords([
      {
        ...base,
        id: "r1",
        created_at: "2022-11-10T12:00:00.000Z",
        diagnoses_rows: [
          { name: "Hipertensión arterial", cie10_code: "I10", is_chronic: true },
          { name: "Cefalea" },
        ],
      },
      {
        ...base,
        id: "r2",
        created_at: "2022-12-10T12:00:00.000Z",
        diagnoses_rows: [{ name: "Hipertensión arterial", cie10_code: "I10" }],
      },
    ]);

    expect(diagnosisRows).toEqual([
      {
        id: "d-json-r1-0",
        dateLabel: expect.any(String),
        recordCreatedAt: "2022-11-10T12:00:00.000Z",
        name: "Hipertensión arterial (CIE-10: I10)",
        chronic: true,
        recordId: "r1",
      },
      expect.objectContaining({ id: "d-json-r1-1", name: "Cefalea", chronic: false }),
    ]);
  });

  it("classifies records whose fields look like clinical files as documents", () => {
    const { consultations } = buildEhrPayloadFromRecords([
      {
        id: "f1",
        created_at: "2022-11-10T12:00:00.000Z",
        chief_complaint: "Consulta",
        diagnosis: "laboratorio_2022.pdf",
        evolution: "",
        indications: "",
        professional_name: "Dr. Test",
      },
    ]);
    expect(consultations[0].category).toBe("document");
  });

  it("builds treatment rows from structured JSON only", () => {
    const { treatmentRows } = buildEhrPayloadFromRecords([
      {
        id: "2",
        created_at: "2022-11-10T12:00:00.000Z",
        chief_complaint: "Consulta",
        diagnosis: "HTA",
        evolution: "Estable",
        indications: "Tratamiento:\n- Enalapril 10mg",
        treatments_json: [
          { product: "Enalapril 10mg", dose: "10mg", frequency: "1/día", status: "Actual" },
        ],
        professional_name: "Dr. Test",
      },
    ]);
    expect(treatmentRows).toHaveLength(1);
    expect(treatmentRows[0].product).toContain("Enalapril");
    expect(treatmentRows[0].dose).toBe("10mg");
  });

  it("does not classify long notes as vitals just because they mention signos vitales", () => {
    const { consultations } = buildEhrPayloadFromRecords([
      {
        id: "3",
        created_at: "2026-08-28T20:30:00.000Z",
        chief_complaint: "Control",
        diagnosis: "",
        evolution:
          "Historia Clínica completa. Presenta signos vitales estables (TA 120/80, FC 60 lpm) y continúa control.",
        indications: "",
        professional_name: "Dr. Test",
      },
      {
        id: "4",
        created_at: "2026-08-28T20:31:00.000Z",
        chief_complaint: "Signos vitales",
        diagnosis: "",
        evolution: "Signos vitales: TA 120/80 FC 72",
        indications: "",
        professional_name: "Dr. Test",
      },
    ]);
    expect(consultations.find((c) => c.id === "3")?.category).toBe("evolution");
    expect(consultations.find((c) => c.id === "4")?.category).toBe("vitals");
  });
});
