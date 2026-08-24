import { describe, expect, it } from "vitest";

import { addonFeatureForDatosExportFlujo } from "@/core/entitlements/datos-features";
import { commercialFeatureLabel } from "@/core/entitlements/feature-labels";
import { FEATURES } from "@/core/entitlements/features";

describe("commercialFeatureLabel", () => {
  it("returns Spanish labels for known keys", () => {
    expect(commercialFeatureLabel(FEATURES.API)).toBe("API pública");
    expect(commercialFeatureLabel(FEATURES.DATA_EXPORT)).toBe("Exportación de datos");
    expect(commercialFeatureLabel(FEATURES.PORTAL)).toMatch(/portal/i);
  });

  it("falls back to the raw key for unknown values", () => {
    expect(commercialFeatureLabel("unknown.feature")).toBe("unknown.feature");
  });
});

describe("addonFeatureForDatosExportFlujo", () => {
  it("gates spreadsheet and bulk exports only", () => {
    expect(addonFeatureForDatosExportFlujo("export-pacientes")).toBe(FEATURES.DATA_EXPORT);
    expect(addonFeatureForDatosExportFlujo("export-masivo")).toBe(FEATURES.DATA_EXPORT);
    expect(addonFeatureForDatosExportFlujo("export-hc")).toBeNull();
    expect(addonFeatureForDatosExportFlujo("historial")).toBeNull();
    expect(addonFeatureForDatosExportFlujo("import-pacientes")).toBeNull();
  });
});
