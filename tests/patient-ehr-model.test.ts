import { describe, expect, it } from "vitest";

import { buildEhrPayloadFromRecords } from "@/features/pacientes/utils/patient-ehr-model";

describe("buildEhrPayloadFromRecords", () => {
  it("builds diagnosis and treatment rows", () => {
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
    expect(diagnosisRows).toHaveLength(1);
    expect(treatmentRows.length).toBeGreaterThanOrEqual(2);
  });
});
