import { describe, expect, it } from "vitest";

import {
  configuracionSectionFeature,
  isConfiguracionSectionEntitledBySnapshot,
} from "@/core/entitlements/config-features";
import { FEATURES } from "@/core/entitlements/features";
import type { ClientEntitlementsSnapshot } from "@/core/entitlements/types";

describe("configuracionSectionFeature", () => {
  it("maps in-page add-on sections", () => {
    expect(configuracionSectionFeature("asistente-ia")).toBe(FEATURES.AI);
    expect(configuracionSectionFeature("api-publica")).toBe(FEATURES.API);
    expect(configuracionSectionFeature("pami")).toBe(FEATURES.PAMI);
    expect(configuracionSectionFeature("apps")).toBe(FEATURES.PORTAL);
  });

  it("does not gate core clinic settings or datos import", () => {
    expect(configuracionSectionFeature("clinica")).toBeUndefined();
    expect(configuracionSectionFeature("equipo")).toBeUndefined();
    expect(configuracionSectionFeature("import-export")).toBeUndefined();
    expect(configuracionSectionFeature("plan")).toBeUndefined();
  });
});

describe("isConfiguracionSectionEntitledBySnapshot", () => {
  it("fails open when the catalog is missing", () => {
    expect(isConfiguracionSectionEntitledBySnapshot("asistente-ia", null)).toBe(true);
    expect(
      isConfiguracionSectionEntitledBySnapshot("asistente-ia", {
        catalogAvailable: false,
        planKey: null,
        status: null,
        allowed: {},
        usage: {},
        limits: {},
      })
    ).toBe(true);
  });

  it("hides IA when the plan denies it; PAMI stays open in phase 29", () => {
    const snapshot: ClientEntitlementsSnapshot = {
      catalogAvailable: true,
      planKey: "basic",
      status: "active",
      allowed: { [FEATURES.AI]: false, [FEATURES.PAMI]: false, [FEATURES.API]: true },
      usage: {},
      limits: {},
    };
    expect(isConfiguracionSectionEntitledBySnapshot("asistente-ia", snapshot)).toBe(false);
    expect(isConfiguracionSectionEntitledBySnapshot("pami", snapshot)).toBe(true);
    expect(isConfiguracionSectionEntitledBySnapshot("api-publica", snapshot)).toBe(true);
    expect(isConfiguracionSectionEntitledBySnapshot("clinica", snapshot)).toBe(true);
  });
});
