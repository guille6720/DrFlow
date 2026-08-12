import { describe, expect, it } from "vitest";

import { formatGeminiClinicalContext } from "@/lib/ai/gemini-clinical-context";

describe("formatGeminiClinicalContext", () => {
  it("never includes the real patient name", () => {
    const text = formatGeminiClinicalContext({
      patientToken: "PACIENTE_A",
      ageYears: 54,
      insuranceProvider: "OSDE",
      records: [
        {
          date: "2026-08-01",
          chiefComplaint: "Control HTA",
          diagnosis: "HTA",
          evolution: "Estable. [REDACTADO] refiere buena adherencia.",
          indications: "Continuar enalapril",
        },
      ],
    });

    expect(text).toContain("PACIENTE_A");
    expect(text).toContain("54 años");
    expect(text).toContain("OSDE");
    expect(text).toContain("Control HTA");
    expect(text).not.toMatch(/Ana|García|DNI/i);
  });
});
