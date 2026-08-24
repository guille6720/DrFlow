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
});
