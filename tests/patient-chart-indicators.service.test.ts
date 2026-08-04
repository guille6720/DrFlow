import { describe, expect, it } from "vitest";
import {
  mergeClinicalIndicators,
  upsertCreatinineLab,
} from "@/features/pacientes/services/patient-chart-indicators.service";

describe("patient-chart-indicators.service", () => {
  it("upsertCreatinineLab adds creatinine entry", () => {
    const labs = upsertCreatinineLab(undefined, 1.2);
    expect(labs).toHaveLength(1);
    expect(labs?.[0].name).toBe("Creatinina");
    expect(labs?.[0].value).toBe("1.2");
  });

  it("upsertCreatinineLab removes creatinine when value cleared", () => {
    const labs = upsertCreatinineLab(
      [{ name: "Creatinina", value: "1.0", unit: "mg/dL", status: "unknown" }],
      null
    );
    expect(labs).toBeUndefined();
  });

  it("mergeClinicalIndicators preserves existing extras and updates weight", () => {
    const notes = mergeClinicalIndicators(
      'Notas libres\n<!--DRFLOW_CHART:{"weight_kg":70}-->',
      { weightKg: 72, heightCm: 175 }
    );
    expect(notes).toContain("Notas libres");
    expect(notes).toContain('"weight_kg":72');
    expect(notes).toContain('"height_cm":175');
  });

  it("mergeClinicalIndicators calculates pack years from smoking input", () => {
    const notes = mergeClinicalIndicators(null, {
      cigarettesPerDay: 20,
      smokingYears: 10,
    });
    expect(notes).toContain('"pack_years":10');
  });
});
