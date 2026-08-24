import { describe, expect, it } from "vitest";

import { buildIndicationsSnapshot } from "@/features/historias/utils/clinical-structured-entries";
import { buildConsultIndicationsText } from "@/features/recetas/utils/build-consult-indications-text";
import { formatPrescriptionMedicationLabel } from "@/features/recetas/utils/format-prescription-medication-label";

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
  it("prefers brand and presentation with dose/frequency when present", () => {
    expect(formatPrescriptionMedicationLabel(sampleMed)).toBe(
      "ROSUVAST 10 MG comp. x 30 · 10 mg · 1/día"
    );
  });

  it("falls back to generic name with dose/frequency when present", () => {
    expect(formatPrescriptionMedicationLabel({ ...sampleMed, brand_name: undefined })).toBe(
      "Rosuvastatina · 10 mg · 1/día"
    );
  });
});

describe("buildConsultIndicationsText", () => {
  it("keeps medications separate from catalog treatments in the snapshot", () => {
    expect(
      buildConsultIndicationsText([sampleMed], "Control en 30 días", [
        {
          product: "Reposo",
          kind: "non_pharmacologic",
          category: "No farmacológicos",
        },
      ])
    ).toBe(
      [
        "Tratamiento / conducta:",
        "- Reposo",
        "",
        "Medicamento:",
        "- ROSUVAST 10 MG comp. x 30 · 10 mg · 1/día",
        "",
        "Notas:",
        "Control en 30 días",
      ].join("\n")
    );
  });

  it("returns only free text when no medications or catalog treatments", () => {
    expect(buildConsultIndicationsText([], "Reposo")).toBe("Reposo");
  });
});

describe("buildIndicationsSnapshot", () => {
  it("separates plan and medication kinds", () => {
    const snapshot = buildIndicationsSnapshot(
      [
        { product: "Control clínico", kind: "conduct", category: "Conductas" },
        { product: "Enalapril", dose: "10mg", frequency: "1/día", kind: "medication" },
      ],
      "Control"
    );
    expect(snapshot).toContain("Tratamiento / conducta:");
    expect(snapshot).toContain("- Control clínico");
    expect(snapshot).toContain("Medicamento:");
    expect(snapshot).toContain("- Enalapril · 10mg · 1/día");
    expect(snapshot).toContain("Notas:\nControl");
  });
});
