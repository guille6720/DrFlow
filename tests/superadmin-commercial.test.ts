import { describe, expect, it } from "vitest";

import { FEATURES } from "@/core/entitlements/features";
import { diffPlanFeatures } from "@/core/entitlements/plan-diff";
import { PLAN_KEYS } from "@/core/entitlements/plan-keys";
import { getPlanRecommendation } from "@/core/entitlements/plan-recommendation";
import {
  classifyUsageBand,
  usagePercentage,
} from "@/core/entitlements/usage-thresholds";
import { canAccessRoute } from "@/core/permissions/roles";

describe("plan recommendation engine", () => {
  it("Basic usage → no recommendation", () => {
    const result = getPlanRecommendation({
      currentPlanKey: PLAN_KEYS.BASIC,
      status: "active",
      enabledFeatures: {
        [FEATURES.PATIENTS]: true,
        [FEATURES.APPOINTMENTS]: true,
        [FEATURES.CLINICAL_HISTORY]: true,
      },
      usage: { [FEATURES.PATIENTS_MAX]: 100 },
      limits: { [FEATURES.PATIENTS_MAX]: 500 },
      counts: { patients: 100, users: 2, professionals: 1 },
    });
    expect(result.shouldRecommendUpgrade).toBe(false);
    expect(result.recommendedPlan).toBeNull();
  });

  it("Basic + PAMI → Pro recommendation", () => {
    const result = getPlanRecommendation({
      currentPlanKey: PLAN_KEYS.BASIC,
      status: "active",
      enabledFeatures: { [FEATURES.PAMI]: true },
      usage: {},
      limits: {},
    });
    expect(result.shouldRecommendUpgrade).toBe(true);
    expect(result.recommendedPlan).toBe(PLAN_KEYS.PRO);
  });

  it("Pro + AI (plan) → Premium recommendation", () => {
    const result = getPlanRecommendation({
      currentPlanKey: PLAN_KEYS.PRO,
      status: "active",
      enabledFeatures: { [FEATURES.AI]: true },
      overrideGrantedFeatures: {},
      usage: {},
      limits: {},
    });
    expect(result.shouldRecommendUpgrade).toBe(true);
    expect(result.recommendedPlan).toBe(PLAN_KEYS.PREMIUM);
  });

  it("Pro + AI override → no Premium solely from AI", () => {
    const result = getPlanRecommendation({
      currentPlanKey: PLAN_KEYS.PRO,
      status: "active",
      enabledFeatures: { [FEATURES.AI]: true },
      overrideGrantedFeatures: { [FEATURES.AI]: true },
      usage: {},
      limits: {},
    });
    expect(result.recommendedPlan).not.toBe(PLAN_KEYS.PREMIUM);
  });

  it("Legacy → manual review", () => {
    const result = getPlanRecommendation({
      currentPlanKey: PLAN_KEYS.LEGACY,
      status: "active",
      enabledFeatures: { [FEATURES.AI]: true, [FEATURES.PAMI]: true },
      usage: {},
      limits: {},
    });
    expect(result.shouldRecommendUpgrade).toBe(false);
    expect(result.severity).toBe("manual_review");
  });

  it("Trial → paid-plan recommendation only", () => {
    const result = getPlanRecommendation({
      currentPlanKey: PLAN_KEYS.TRIAL,
      status: "trialing",
      enabledFeatures: { [FEATURES.PAMI]: true },
      usage: {},
      limits: {},
    });
    expect(result.shouldRecommendUpgrade).toBe(true);
    expect(result.recommendedPlan).toBe(PLAN_KEYS.PRO);
    expect(result.reasons.some((r) => /Trial/i.test(r))).toBe(true);
  });
});

describe("usage thresholds", () => {
  it("computes percentages and bands", () => {
    expect(usagePercentage(87, 100)).toBe(87);
    expect(classifyUsageBand(87, 100)).toBe("warning");
    expect(classifyUsageBand(100, 100)).toBe("critical");
    expect(classifyUsageBand(10, null)).toBe("unlimited");
  });
});

describe("plan diff", () => {
  it("compares features without hardcoded matrix", () => {
    const diff = diffPlanFeatures(
      "basic",
      "pro",
      [{ key: FEATURES.PAMI, enabled: false, value: null }],
      [{ key: FEATURES.PAMI, enabled: true, value: null }]
    );
    expect(diff.featuresGained.length).toBeGreaterThan(0);
    expect(diff.isDowngrade).toBe(false);
  });
});

describe("superadmin route access", () => {
  it("non-superadmin cannot access /superadmin", () => {
    expect(canAccessRoute("clinic_admin", "/superadmin", false)).toBe(false);
    expect(canAccessRoute("doctor", "/superadmin/clinics", false)).toBe(false);
  });

  it("superadmin can access /superadmin", () => {
    expect(canAccessRoute("clinic_admin", "/superadmin", true)).toBe(true);
    expect(canAccessRoute(null, "/superadmin/plans", true)).toBe(true);
  });
});
