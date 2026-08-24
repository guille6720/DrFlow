import { describe, expect, it } from "vitest";

import {
  catalogToMedicationSelection,
  formatVademecumPrescriptionLabel,
  vademecumToPrescription,
} from "@/features/recetas/components/recetas/vademecum-to-prescription";

const sample = {
  id: "1",
  catalog_source: "alfabeta" as const,
  product_code: "42415",
  active_ingredient: "Rosuvastatina",
  brand_name: "ROSUVASTATINA VANNIER",
  presentation: "40 mg comp.x 30",
  laboratory: "Vannier",
  reference_price: 1000,
  coverage_pct: 50,
  affiliate_amount: 500,
  price_list_date: "2026-07-01",
};

describe("catalogToMedicationSelection", () => {
  it("fills identity from catalog without inventing dose, frequency or duration", () => {
    const med = catalogToMedicationSelection(sample);
    expect(med.generic_name).toBe("Rosuvastatina");
    expect(med.brand_name).toBe("ROSUVASTATINA VANNIER");
    expect(med.presentation).toBe("40 mg comp.x 30");
    expect(med.concentration).toBe("40 mg");
    expect(med.dose).toBe("");
    expect(med.frequency).toBe("");
    expect(med.posology).toBe("");
    expect(med.duration_days).toBeUndefined();
    expect(med.route).toBe("");
    expect(med.quantity).toBe(0);
  });
});

describe("vademecumToPrescription", () => {
  it("maps vademécum row to prescription medication", () => {
    const med = vademecumToPrescription(sample);
    expect(med.generic_name).toBe("Rosuvastatina");
    expect(med.brand_name).toBe("ROSUVASTATINA VANNIER");
    expect(med.presentation).toBe("40 mg comp.x 30");
    expect(med.concentration).toBe("40 mg");
    expect(med.quantity).toBe(1);
    expect(med.route).toBe("oral");
    expect(med.vademecum_code).toBe("42415");
    expect(med.search_source).toBe("catalog");
  });

  it("formats drapp-style label", () => {
    expect(formatVademecumPrescriptionLabel(sample)).toBe("ROSUVASTATINA VANNIER 40 mg comp.x 30");
  });
});

describe("appendPrescriptionMedication", () => {
  it("replaces empty starter row", async () => {
    const { appendPrescriptionMedication, emptyPrescriptionMedication } = await import(
      "@/features/recetas/components/recetas/prescription-form-utils"
    );
    const med = vademecumToPrescription(sample);
    expect(appendPrescriptionMedication([emptyPrescriptionMedication()], med)).toEqual([med]);
  });
});
