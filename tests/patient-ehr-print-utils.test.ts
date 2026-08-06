import { describe, expect, it } from "vitest";

import {
  formatPrintHeaderDate,
  formatPrintTableDate,
  parseInlineDiagnoses,
  parseInlineTreatments,
} from "@/features/historias/components/historias/patient-ehr-print-utils";
import type { PatientEhrConsultation } from "@/features/pacientes/utils/patient-ehr-model";

function consultation(partial: Partial<PatientEhrConsultation>): PatientEhrConsultation {
  return {
    id: "1",
    created_at: "2022-11-10T12:04:12.000Z",
    professional_name: "Leonardi, Oscar Angel",
    chief_complaint: "",
    diagnosis: "",
    evolution: "",
    indications: "",
    category: "evolution",
    ...partial,
  };
}

describe("patient-ehr-print-utils", () => {
  it("formats header and table dates like Equipos export", () => {
    expect(formatPrintHeaderDate("2022-11-10T12:04:12.000Z")).toBe("10-NOV-22");
    expect(formatPrintTableDate("2022-11-10T12:04:12.000Z")).toBe("10-NOV");
  });

  it("parses inline diagnoses and treatments", () => {
    const c = consultation({
      diagnosis: "Infarto transmural agudo del miocardio de la pared anterior",
      indications: "GASTEC\n20 mg caps.x 70\nFILTEN\n12.5 mg comp.ran.x 60",
    });

    expect(parseInlineDiagnoses(c)).toEqual([
      "Infarto transmural agudo del miocardio de la pared anterior",
    ]);
    expect(parseInlineTreatments(c)).toEqual([
      { product: "GASTEC", dose: "20 mg caps.x 70" },
      { product: "FILTEN", dose: "12.5 mg comp.ran.x 60" },
    ]);
  });
});
