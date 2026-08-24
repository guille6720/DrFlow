import { describe, expect, it } from "vitest";

import { FEATURES } from "@/core/entitlements/features";
import { decideSeatCapacity } from "@/core/entitlements/limits";

describe("Phase 3 seat capacity", () => {
  it("fails open when the catalog is missing", () => {
    expect(
      decideSeatCapacity({
        enforced: true,
        catalogAvailable: false,
        limit: 1,
        currentCount: 99,
        featureKey: FEATURES.PATIENTS_MAX,
      })
    ).toEqual({ ok: true });
  });

  it("allows unlimited (null) and missing limits", () => {
    expect(
      decideSeatCapacity({
        enforced: true,
        catalogAvailable: true,
        limit: null,
        currentCount: 5000,
        featureKey: FEATURES.PATIENTS_MAX,
      })
    ).toEqual({ ok: true });
    expect(
      decideSeatCapacity({
        enforced: true,
        catalogAvailable: true,
        limit: undefined,
        currentCount: 5000,
        featureKey: FEATURES.USERS_MAX,
      })
    ).toEqual({ ok: true });
  });

  it("blocks when the seat cap would be exceeded", () => {
    const denied = decideSeatCapacity({
      enforced: true,
      catalogAvailable: true,
      limit: 3,
      currentCount: 3,
      featureKey: FEATURES.USERS_MAX,
    });
    expect(denied.ok).toBe(false);
    if (!denied.ok) {
      expect(denied.error).toMatch(/usuarios/);
    }
  });

  it("allows the last remaining seat", () => {
    expect(
      decideSeatCapacity({
        enforced: true,
        catalogAvailable: true,
        limit: 3,
        currentCount: 2,
        featureKey: FEATURES.USERS_MAX,
      })
    ).toEqual({ ok: true });
  });
});
