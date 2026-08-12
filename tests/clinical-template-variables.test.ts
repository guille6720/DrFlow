import { describe, expect, it } from "vitest";

import {
  applyTemplateVariableValues,
  extractTemplateVariableKeys,
  resolveClinicalTemplateFields,
} from "@/lib/utils/clinical-template-variables";

describe("clinical-template-variables", () => {
  it("extracts unique variable keys in order", () => {
    expect(
      extractTemplateVariableKeys(
        "PA: [___/___ mmHg]",
        "Control en [30] días",
        "PA: [___/___ mmHg]"
      )
    ).toEqual(["___/___ mmHg", "30"]);
  });

  it("replaces bracket placeholders when values are provided", () => {
    const text = "PA: [___/___ mmHg]. Control en [30] días.";
    expect(
      applyTemplateVariableValues(text, {
        "___/___ mmHg": "130/85 mmHg",
        "30": "45",
      })
    ).toBe("PA: 130/85 mmHg. Control en 45 días.");
  });

  it("keeps brackets when value is empty", () => {
    expect(applyTemplateVariableValues("PA: [___/___ mmHg]", {})).toBe("PA: [___/___ mmHg]");
  });

  it("resolves all consult fields from bases", () => {
    const resolved = resolveClinicalTemplateFields(
      {
        chief_complaint: "Control [motivo]",
        diagnosis: "[dx]",
        evolution: "PA [___/___ mmHg]",
        indications: "Control [plazo] días",
      },
      {
        motivo: "HTA",
        dx: "I10",
        "___/___ mmHg": "120/80 mmHg",
        plazo: "30",
      }
    );

    expect(resolved.chief_complaint).toBe("Control HTA");
    expect(resolved.diagnosis).toBe("I10");
    expect(resolved.evolution).toBe("PA 120/80 mmHg");
    expect(resolved.indications).toBe("Control 30 días");
  });
});
