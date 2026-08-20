import { describe, expect, it } from "vitest";

import { FEATURES } from "@/core/entitlements/features";
import {
  areFeaturesEntitledBySnapshot,
  listCommercialModuleAvailability,
  VISIBLE_COMMERCIAL_MODULES,
} from "@/core/entitlements/module-summary";
import type { ClientEntitlementsSnapshot } from "@/core/entitlements/types";

const empty: ClientEntitlementsSnapshot = {
  catalogAvailable: false,
  planKey: null,
  status: null,
  allowed: {},
  usage: {},
  limits: {},
};

describe("listCommercialModuleAvailability", () => {
  it("hides the lists when the catalog is missing", () => {
    expect(listCommercialModuleAvailability(null)).toEqual({ included: [], excluded: [] });
    expect(listCommercialModuleAvailability(empty)).toEqual({ included: [], excluded: [] });
  });

  it("splits included and excluded add-ons", () => {
    const result = listCommercialModuleAvailability({
      catalogAvailable: true,
      allowed: {
        [FEATURES.AI]: true,
        [FEATURES.CASH_REGISTER]: true,
        [FEATURES.PORTAL]: false,
      },
    });
    expect(result.included.map((row) => row.key)).toContain(FEATURES.AI);
    expect(result.included.map((row) => row.key)).toContain(FEATURES.CASH_REGISTER);
    expect(result.excluded.map((row) => row.key)).toContain(FEATURES.PORTAL);
    expect(result.included.map((row) => row.key)).not.toContain(FEATURES.BRANDING);
    expect(result.included.map((row) => row.key)).not.toContain(FEATURES.PAMI);
    expect(result.excluded.map((row) => row.key)).not.toContain(FEATURES.PAMI);
    expect(VISIBLE_COMMERCIAL_MODULES).toContain(FEATURES.AUTOMATION_FOLLOW_UP);
  });
});

describe("areFeaturesEntitledBySnapshot", () => {
  it("fails open when the catalog is missing", () => {
    expect(areFeaturesEntitledBySnapshot([FEATURES.VOICE, FEATURES.AI_TRANSCRIPTION], null)).toBe(
      true
    );
  });

  it("requires every listed add-on", () => {
    const snapshot: ClientEntitlementsSnapshot = {
      catalogAvailable: true,
      planKey: "premium",
      status: "active",
      allowed: { [FEATURES.VOICE]: true, [FEATURES.AI_TRANSCRIPTION]: false },
      usage: {},
      limits: {},
    };
    expect(areFeaturesEntitledBySnapshot([FEATURES.VOICE], snapshot)).toBe(true);
    expect(
      areFeaturesEntitledBySnapshot([FEATURES.VOICE, FEATURES.AI_TRANSCRIPTION], snapshot)
    ).toBe(false);
  });
});
