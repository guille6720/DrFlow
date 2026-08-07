import { describe, expect, it } from "vitest";

import {
  formatPrintDocumentNumber,
  formatPrintHeaderDate,
  formatPrintTableDate,
  formatPrintTreatmentMetaDate,
  parseInlineDiagnoses,
  parseInlineTreatments,
  professionalMetaLine,
} from "@/features/historias/components/historias/patient-ehr-print-utils";
import type { PatientEhrConsultation } from "@/features/pacientes/utils/patient-ehr-model";

function consultation(partial: Partial<PatientEhrConsultation>): PatientEhrConsultation {
  return {
    id: "1",
    created_at: "2022-11-10T12:04:12.000Z",
    professional_name: "Leonardi, Oscar Angel",
    professional_license_national: "455344",
    professional_license_provincial: "160261",
    professional_email: "osleonardi@gmail.com",
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
      { text: "Infarto transmural agudo del miocardio de la pared anterior", code: null },
    ]);
    expect(parseInlineTreatments(c)).toEqual([
      { product: "GASTEC", lab: "", dose: "20 mg caps.x 70" },
      { product: "FILTEN", lab: "", dose: "12.5 mg comp.ran.x 60" },
    ]);
  });

  it("extracts CIE code from diagnosis line", () => {
    const c = consultation({
      diagnosis: "Infarto transmural agudo del miocardio de la pared anterior I-210",
    });
    expect(parseInlineDiagnoses(c)).toEqual([
      {
        text: "Infarto transmural agudo del miocardio de la pared anterior",
        code: "I-210",
      },
    ]);
  });

  it("splits product and laboratory name", () => {
    const c = consultation({
      indications: "GASTEC Laboratorios Be\n20 mg caps.x 70",
    });
    expect(parseInlineTreatments(c)).toEqual([
      { product: "GASTEC", lab: "Laboratorios Be", dose: "20 mg caps.x 70" },
    ]);
  });

  it("formats demographics and professional meta like Equipos export", () => {
    expect(formatPrintDocumentNumber("12459480")).toBe("12.459.480");
    expect(formatPrintTreatmentMetaDate("2022-11-10T12:04:12.000Z")).toBe("10-NOV-2022 · (n/a)");
    expect(professionalMetaLine(consultation({}))).toBe(
      "Leonardi, Oscar Angel 455344 160261 osleonardi@gmail.com"
    );
  });
});
