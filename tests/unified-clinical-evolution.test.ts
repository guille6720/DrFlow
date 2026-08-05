import { describe, expect, it } from "vitest";

import { buildUnifiedClinicalEvolution } from "@/lib/utils/unified-clinical-evolution";

describe("buildUnifiedClinicalEvolution", () => {
  it("returns evolution when legacy fields are empty", () => {
    expect(
      buildUnifiedClinicalEvolution({
        evolution: "Solo evolución unificada.",
      })
    ).toBe("Solo evolución unificada.");
  });

  it("merges legacy fields with evolution", () => {
    expect(
      buildUnifiedClinicalEvolution({
        chief_complaint: "Dolor abdominal",
        diagnosis: "Gastroenteritis",
        evolution: "Mejoría parcial",
        indications: "Dieta blanda",
      })
    ).toBe("Dolor abdominal\n\nGastroenteritis\n\nMejoría parcial\n\nDieta blanda");
  });
});
