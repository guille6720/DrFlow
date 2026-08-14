import { describe, expect, it } from "vitest";

import { buildConsultIndicationsText } from "@/features/recetas/utils/build-consult-indications-text";
import { formatPrescriptionMedicationLabel } from "@/features/recetas/utils/format-prescription-medication-label";
import { buildIndicationsSnapshot } from "@/features/historias/utils/clinical-structured-entries";

import type { PrescriptionMedication } from "@/types/prescription";

const sampleMed: PrescriptionMedication = {
  generic_name: "Rosuvastatina",
  brand_name: "ROSUVAST",
  presentation: "10 MG comp. x 30",
  quantity: 1,
  posology: "",
  dose: "10 mg",
  frequency: "1/día",
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
  it("builds a printable snapshot with treatment and notes sections", () => {
    expect(buildConsultIndicationsText([sampleMed], "Control en 30 días")).toBe(
      "Tratamiento:\n- ROSUVAST 10 MG comp. x 30 · 10 mg · 1/día\n\nIndicaciones:\nControl en 30 días"
    );
  });

  it("returns only free text when no medications", () => {
    expect(buildConsultIndicationsText([], "Reposo")).toBe("Reposo");
  });
});

describe("buildIndicationsSnapshot", () => {
  it("does not invent parseable pipe rows", () => {
    const snapshot = buildIndicationsSnapshot(
      [{ product: "Enalapril", dose: "10mg", frequency: "1/día" }],
      "Control"
    );
    expect(snapshot).toContain("Tratamiento:");
    expect(snapshot).toContain("- Enalapril · 10mg · 1/día");
    expect(snapshot).toContain("Indicaciones:\nControl");
  });
});
