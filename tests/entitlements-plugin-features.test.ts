import { describe, expect, it } from "vitest";

import { FEATURES } from "@/core/entitlements/features";
import { addonFeatureForClinicPlugin, addonFeaturesForClinicPlugin } from "@/core/entitlements/plugin-features";

describe("addonFeatureForClinicPlugin", () => {
  it("maps optional add-on plugins", () => {
    expect(addonFeatureForClinicPlugin("pami")).toBe(FEATURES.PAMI);
    expect(addonFeatureForClinicPlugin("ia")).toBe(FEATURES.AI);
    expect(addonFeatureForClinicPlugin("telemedicina")).toBe(FEATURES.TELEMEDICINE);
    expect(addonFeatureForClinicPlugin("pharmacology")).toBe(FEATURES.PHARMACOLOGY);
    expect(addonFeatureForClinicPlugin("portal")).toBe(FEATURES.PORTAL);
    expect(addonFeatureForClinicPlugin("voice")).toBe(FEATURES.VOICE);
  });

  it("requires transcription plus voice to enable the voice plugin", () => {
    expect(addonFeaturesForClinicPlugin("voice")).toEqual([
      FEATURES.VOICE,
      FEATURES.AI_TRANSCRIPTION,
    ]);
    expect(addonFeaturesForClinicPlugin("ia")).toEqual([FEATURES.AI]);
  });

  it("does not gate lab or planned plugins", () => {
    expect(addonFeatureForClinicPlugin("facturacion")).toBeNull();
    expect(addonFeatureForClinicPlugin("laboratorio")).toBeNull();
    expect(addonFeatureForClinicPlugin("imagenes")).toBeNull();
  });
});
