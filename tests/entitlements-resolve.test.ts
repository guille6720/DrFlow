import { describe, expect, it } from "vitest";

import { FEATURES } from "@/core/entitlements/features";
import {
  canUseFeatureWithCommercialStatus,
  canUseResolvedEntitlement,
  getResolvedFeatureLimit,
  resolveFeatureEntitlement,
  toClientEntitlementsSnapshot,
} from "@/core/entitlements/resolve";
import type { FeatureCatalogRow } from "@/core/entitlements/types";

const cashRegister: FeatureCatalogRow = {
  key: FEATURES.CASH_REGISTER,
  featureType: "boolean",
  defaultValue: false,
  usageMetered: false,
  isActive: true,
};

const aiRequests: FeatureCatalogRow = {
  key: FEATURES.AI_MONTHLY_REQUESTS,
  featureType: "limit",
  defaultValue: 0,
  usageMetered: true,
  isActive: true,
};

describe("resolveFeatureEntitlement", () => {
  it("uses plan enabled=true", () => {
    const resolved = resolveFeatureEntitlement({
      feature: cashRegister,
      planFeature: { enabled: true, value: null },
    });
    expect(resolved.enabled).toBe(true);
    expect(resolved.source).toBe("plan");
    expect(canUseResolvedEntitlement(resolved)).toBe(true);
  });

  it("uses plan enabled=false", () => {
    const resolved = resolveFeatureEntitlement({
      feature: cashRegister,
      planFeature: { enabled: false, value: null },
    });
    expect(resolved.enabled).toBe(false);
    expect(canUseResolvedEntitlement(resolved)).toBe(false);
  });

  it("override true beats plan false", () => {
    const resolved = resolveFeatureEntitlement({
      feature: cashRegister,
      planFeature: { enabled: false, value: null },
      override: { enabled: true, value: null, startsAt: null, endsAt: null },
    });
    expect(resolved.enabled).toBe(true);
    expect(resolved.source).toBe("override");
  });

  it("override false beats plan true", () => {
    const resolved = resolveFeatureEntitlement({
      feature: cashRegister,
      planFeature: { enabled: true, value: null },
      override: { enabled: false, value: null, startsAt: null, endsAt: null },
    });
    expect(resolved.enabled).toBe(false);
    expect(resolved.source).toBe("override");
  });

  it("ignores expired override", () => {
    const resolved = resolveFeatureEntitlement({
      feature: cashRegister,
      planFeature: { enabled: false, value: null },
      override: {
        enabled: true,
        value: null,
        startsAt: "2020-01-01T00:00:00.000Z",
        endsAt: "2020-02-01T00:00:00.000Z",
      },
      now: new Date("2026-08-19T12:00:00.000Z"),
    });
    expect(resolved.source).toBe("plan");
    expect(resolved.enabled).toBe(false);
  });

  it("ignores future override", () => {
    const resolved = resolveFeatureEntitlement({
      feature: cashRegister,
      planFeature: { enabled: false, value: null },
      override: {
        enabled: true,
        value: null,
        startsAt: "2026-09-01T00:00:00.000Z",
        endsAt: "2026-10-01T00:00:00.000Z",
      },
      now: new Date("2026-08-19T12:00:00.000Z"),
    });
    expect(resolved.source).toBe("plan");
    expect(resolved.enabled).toBe(false);
  });

  it("applies currently active temporary override", () => {
    const resolved = resolveFeatureEntitlement({
      feature: cashRegister,
      planFeature: { enabled: false, value: null },
      override: {
        enabled: true,
        value: null,
        startsAt: "2026-08-01T00:00:00.000Z",
        endsAt: "2026-09-01T00:00:00.000Z",
      },
      now: new Date("2026-08-19T12:00:00.000Z"),
    });
    expect(resolved.source).toBe("override");
    expect(resolved.enabled).toBe(true);
  });

  it("denies unknown or inactive feature", () => {
    expect(
      canUseResolvedEntitlement(
        resolveFeatureEntitlement({
          feature: null,
        })
      )
    ).toBe(false);
    expect(
      resolveFeatureEntitlement({
        feature: { ...cashRegister, isActive: false },
        planFeature: { enabled: true, value: null },
      }).source
    ).toBe("deny");
  });

  it("falls back to fail-closed default", () => {
    const resolved = resolveFeatureEntitlement({ feature: cashRegister });
    expect(resolved.source).toBe("default");
    expect(resolved.enabled).toBe(false);
    expect(canUseResolvedEntitlement(resolved)).toBe(false);
  });
});

describe("limits", () => {
  it("returns plan limit 100", () => {
    const resolved = resolveFeatureEntitlement({
      feature: aiRequests,
      planFeature: { enabled: true, value: 100 },
    });
    expect(getResolvedFeatureLimit(resolved)).toBe(100);
  });

  it("returns override 500 over plan 100", () => {
    const resolved = resolveFeatureEntitlement({
      feature: aiRequests,
      planFeature: { enabled: true, value: 100 },
      override: { enabled: true, value: 500, startsAt: null, endsAt: null },
    });
    expect(getResolvedFeatureLimit(resolved)).toBe(500);
    expect(resolved.source).toBe("override");
  });

  it("returns null for unlimited", () => {
    const resolved = resolveFeatureEntitlement({
      feature: aiRequests,
      planFeature: { enabled: true, value: null },
    });
    expect(getResolvedFeatureLimit(resolved)).toBeNull();
    expect(canUseResolvedEntitlement(resolved)).toBe(true);
  });

  it("returns 0 when disabled", () => {
    const resolved = resolveFeatureEntitlement({
      feature: aiRequests,
      planFeature: { enabled: false, value: 100 },
    });
    expect(getResolvedFeatureLimit(resolved)).toBe(0);
    expect(canUseResolvedEntitlement(resolved)).toBe(false);
  });
});

describe("toClientEntitlementsSnapshot commercial status", () => {
  it("pauses add-ons when past_due without hiding core patients", () => {
    const snapshot = toClientEntitlementsSnapshot({
      clinicId: "clinic-id",
      planKey: "pro",
      planId: "plan-id",
      status: "past_due",
      trialEndsAt: null,
      catalogAvailable: true,
      features: {
        [FEATURES.CASH_REGISTER]: {
          enabled: true,
          limit: null,
          source: "plan",
          featureType: "boolean",
        },
        [FEATURES.PATIENTS]: {
          enabled: true,
          limit: null,
          source: "plan",
          featureType: "boolean",
        },
      },
      usage: {},
      usagePeriodStart: null,
    });
    expect(snapshot.allowed[FEATURES.CASH_REGISTER]).toBe(false);
    expect(snapshot.allowed[FEATURES.PATIENTS]).toBe(true);
  });

  it("keeps an active override during past_due", () => {
    const snapshot = toClientEntitlementsSnapshot({
      clinicId: "clinic-id",
      planKey: "basic",
      planId: "plan-id",
      status: "past_due",
      trialEndsAt: null,
      catalogAvailable: true,
      features: {
        [FEATURES.CASH_REGISTER]: {
          enabled: true,
          limit: null,
          source: "override",
          featureType: "boolean",
        },
      },
      usage: {},
      usagePeriodStart: null,
    });
    expect(snapshot.allowed[FEATURES.CASH_REGISTER]).toBe(true);
  });

  it("does not grant a disabled override during past_due", () => {
    const snapshot = toClientEntitlementsSnapshot({
      clinicId: "clinic-id",
      planKey: "pro",
      planId: "plan-id",
      status: "past_due",
      trialEndsAt: null,
      catalogAvailable: true,
      features: {
        [FEATURES.CASH_REGISTER]: {
          enabled: false,
          limit: 0,
          source: "override",
          featureType: "boolean",
        },
      },
      usage: {},
      usagePeriodStart: null,
    });
    expect(snapshot.allowed[FEATURES.CASH_REGISTER]).toBe(false);
  });
});

describe("canUseFeatureWithCommercialStatus", () => {
  const base = {
    clinicId: "clinic-id",
    planKey: "pro" as const,
    planId: "plan-id",
    trialEndsAt: null,
    catalogAvailable: true,
    usage: {},
    usagePeriodStart: null,
  };

  it("fails open when the catalog is missing", () => {
    expect(
      canUseFeatureWithCommercialStatus(
        {
          ...base,
          status: "past_due",
          catalogAvailable: false,
          features: {},
        },
        FEATURES.CASH_REGISTER
      )
    ).toBe(true);
  });

  it("allows core patients even when past_due", () => {
    expect(
      canUseFeatureWithCommercialStatus(
        {
          ...base,
          status: "past_due",
          features: {
            [FEATURES.PATIENTS]: {
              enabled: true,
              limit: null,
              source: "plan",
              featureType: "boolean",
            },
          },
        },
        FEATURES.PATIENTS
      )
    ).toBe(true);
  });

  it("pauses plan add-ons when the commercial trial has lapsed", () => {
    expect(
      canUseFeatureWithCommercialStatus(
        {
          ...base,
          status: "trialing",
          trialEndsAt: "2020-01-01T00:00:00.000Z",
          features: {
            [FEATURES.CASH_REGISTER]: {
              enabled: true,
              limit: null,
              source: "plan",
              featureType: "boolean",
            },
            [FEATURES.PATIENTS]: {
              enabled: true,
              limit: null,
              source: "plan",
              featureType: "boolean",
            },
          },
        },
        FEATURES.CASH_REGISTER
      )
    ).toBe(false);
    expect(
      canUseFeatureWithCommercialStatus(
        {
          ...base,
          status: "trialing",
          trialEndsAt: "2020-01-01T00:00:00.000Z",
          features: {
            [FEATURES.PATIENTS]: {
              enabled: true,
              limit: null,
              source: "plan",
              featureType: "boolean",
            },
          },
        },
        FEATURES.PATIENTS
      )
    ).toBe(true);
  });
});
