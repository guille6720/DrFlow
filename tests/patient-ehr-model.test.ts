import { describe, expect, it } from "vitest";

import { buildIndicationsSnapshot } from "@/features/historias/utils/clinical-structured-entries";
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

  it("hides the legacy quick-save copy while preserving notes and other doses", () => {
    const medication = {
      product: "Enalapril",
      kind: "medication" as const,
      dose: "10 mg",
      frequency: "1/día",
      status: "Actual",
      notes: "Con el desayuno",
    };
    const edited = { ...medication, notes: "Con el desayuno · Inicio: 2026-08-28" };
    const treatments = [edited, medication, { ...medication, dose: "5 mg" }];
    const record = {
      id: "quick",
      created_at: "2026-08-28T20:30:00.000Z",
      chief_complaint: "Tratamiento",
      diagnosis: "",
      evolution: medication.product,
      indications: buildIndicationsSnapshot(treatments),
      treatments_json: treatments,
      professional_name: "Dr. Test",
    };
    const { consultations, treatmentRows } = buildEhrPayloadFromRecords([
      record,
      { ...record, id: "separate", treatments_json: [medication] },
    ]);
    expect(treatmentRows.map((row) => [row.recordId, row.dose])).toEqual([
      ["quick", "10 mg"],
      ["quick", "5 mg"],
      ["separate", "10 mg"],
    ]);
    expect(treatmentRows[0].notes).toBe(edited.notes);
    expect(consultations[0].indications).toBe(buildIndicationsSnapshot([edited, treatments[2]]));
  });
});
