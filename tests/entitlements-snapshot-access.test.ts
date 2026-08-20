import { describe, expect, it } from "vitest";

import { FEATURES } from "@/core/entitlements/features";
import { isFeatureEntitledBySnapshot } from "@/core/entitlements/snapshot-access";
import type { ClientEntitlementsSnapshot } from "@/core/entitlements/types";

describe("isFeatureEntitledBySnapshot", () => {
  it("fails open without a feature key or catalog", () => {
    expect(isFeatureEntitledBySnapshot(null, null)).toBe(true);
    expect(isFeatureEntitledBySnapshot(FEATURES.API, null)).toBe(true);
    expect(
      isFeatureEntitledBySnapshot(FEATURES.API, {
        catalogAvailable: false,
        planKey: null,
        status: null,
        allowed: {},
        usage: {},
        limits: {},
      })
    ).toBe(true);
  });

  it("reads the allowed map when the catalog is live", () => {
    const snapshot: ClientEntitlementsSnapshot = {
      catalogAvailable: true,
      planKey: "basic",
      status: "active",
      allowed: { [FEATURES.API]: false, [FEATURES.PORTAL]: true },
      usage: {},
      limits: {},
    };
    expect(isFeatureEntitledBySnapshot(FEATURES.API, snapshot)).toBe(false);
    expect(isFeatureEntitledBySnapshot(FEATURES.PORTAL, snapshot)).toBe(true);
  });
});
