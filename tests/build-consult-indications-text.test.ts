import { describe, expect, it } from "vitest";

import { buildConsultIndicationsText } from "@/features/recetas/utils/build-consult-indications-text";
import { formatPrescriptionMedicationLabel } from "@/features/recetas/utils/format-prescription-medication-label";

import type { PrescriptionMedication } from "@/types/prescription";

const sampleMed: PrescriptionMedication = {
  generic_name: "Rosuvastatina",
  brand_name: "ROSUVAST",
  presentation: "10 MG comp. x 30",
  quantity: 1,
  posology: "",
};

describe("formatPrescriptionMedicationLabel", () => {
  it("prefers brand and presentation", () => {
    expect(formatPrescriptionMedicationLabel(sampleMed)).toBe("ROSUVAST 10 MG comp. x 30");
  });

  it("falls back to generic name", () => {
    expect(formatPrescriptionMedicationLabel({ ...sampleMed, brand_name: undefined })).toBe(
      "Rosuvastatina"
    );
  });
});

describe("buildConsultIndicationsText", () => {
  it("merges medications and free text", () => {
    expect(buildConsultIndicationsText([sampleMed], "Control en 30 días")).toBe(
      "ROSUVAST 10 MG comp. x 30\n\nControl en 30 días"
    );
  });

  it("returns only free text when no medications", () => {
    expect(buildConsultIndicationsText([], "Reposo")).toBe("Reposo");
  });
});
