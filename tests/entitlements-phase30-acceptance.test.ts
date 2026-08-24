/**
 * Phase 30 — commercial entitlement acceptance matrix.
 * Pure TS + migration contract checks (no live DB / no production).
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";

import {
  CORE_UNGATED_FEATURES,
  isFeatureEnforced,
} from "@/core/entitlements/enforcement";
import { FEATURES } from "@/core/entitlements/features";
import {
  isPlanAssignableOnOnboarding,
  MIGRATION_PLAN_KEY,
  ONBOARDING_PLAN_KEY,
  PLAN_KEYS,
} from "@/core/entitlements/plan-keys";
import {
  canUseResolvedEntitlement,
  getResolvedFeatureLimit,
  resolveFeatureEntitlement,
  toClientEntitlementsSnapshot,
} from "@/core/entitlements/resolve";
import { isFeatureEntitledBySnapshot } from "@/core/entitlements/snapshot-access";
import { resolveTrustedClinicId } from "@/core/entitlements/trusted-clinic";
import type { ClientEntitlementsSnapshot, FeatureCatalogRow } from "@/core/entitlements/types";
import {
  AtomicUsageLedger,
  decideUsageIncrement,
} from "@/core/entitlements/usage-consume";

const migration121 = readFileSync(
  resolve(process.cwd(), "supabase/migrations/121_commercial_entitlements.sql"),
  "utf8"
);

const clinicA = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const clinicB = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

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

const meteredBase = {
  currentAmount: 10,
  amount: 1,
  limit: 100 as number | null,
  metered: true,
  featureKnown: true,
  featureActive: true,
};

describe("Phase 30 acceptance — existing organization", () => {
  it("maps existing org → legacy → active", () => {
    expect(MIGRATION_PLAN_KEY).toBe(PLAN_KEYS.LEGACY);
    expect(migration121).toMatch(/legacy_backfill/);
    expect(migration121).toMatch(/p\.key = 'legacy'/);
    expect(migration121).toMatch(/'active'/);
    expect(migration121).toMatch(/WHERE NOT EXISTS/);
  });

  it("preserves current clinical functionality for legacy/active clinics", () => {
    // Legacy seed grants full catalog in SQL; app never enforces core modules.
    expect(migration121).toMatch(/p\.key IN \('trial', 'legacy', 'enterprise'\)/);
    for (const key of CORE_UNGATED_FEATURES) {
      expect(isFeatureEnforced(key)).toBe(false);
    }

    const legacySnapshot: ClientEntitlementsSnapshot = {
      catalogAvailable: true,
      planKey: PLAN_KEYS.LEGACY,
      status: "active",
      allowed: {
        [FEATURES.PATIENTS]: true,
        [FEATURES.CLINICAL_HISTORY]: true,
        [FEATURES.APPOINTMENTS]: true,
        [FEATURES.MEDICAL_ORDERS]: true,
        [FEATURES.DOCUMENTS]: true,
        [FEATURES.BASIC_REPORTS]: true,
        [FEATURES.PAMI]: true,
      },
      usage: {},
      limits: {},
    };
    expect(isFeatureEntitledBySnapshot(FEATURES.PATIENTS, legacySnapshot)).toBe(true);
    expect(isFeatureEntitledBySnapshot(FEATURES.CLINICAL_HISTORY, legacySnapshot)).toBe(true);
    expect(isFeatureEntitledBySnapshot(FEATURES.APPOINTMENTS, legacySnapshot)).toBe(true);
    expect(isFeatureEntitledBySnapshot(FEATURES.PAMI, legacySnapshot)).toBe(true);

    // Even if catalog rows were denied, phase-29 deferred + core stay open.
    const deniedButLive: ClientEntitlementsSnapshot = {
      ...legacySnapshot,
      allowed: {
        [FEATURES.PATIENTS]: false,
        [FEATURES.PAMI]: false,
        [FEATURES.CASH_REGISTER]: false,
      },
    };
    expect(isFeatureEntitledBySnapshot(FEATURES.PATIENTS, deniedButLive)).toBe(true);
    expect(isFeatureEntitledBySnapshot(FEATURES.PAMI, deniedButLive)).toBe(true);
  });
});

describe("Phase 30 acceptance — new organization", () => {
  it("maps new org → trial → trialing and never legacy", () => {
    expect(ONBOARDING_PLAN_KEY).toBe(PLAN_KEYS.TRIAL);
    expect(ONBOARDING_PLAN_KEY).not.toBe(PLAN_KEYS.LEGACY);
    expect(
      isPlanAssignableOnOnboarding({
        key: PLAN_KEYS.TRIAL,
        is_internal: false,
        is_public: true,
      })
    ).toBe(true);
    expect(
      isPlanAssignableOnOnboarding({
        key: PLAN_KEYS.LEGACY,
        is_internal: true,
        is_public: false,
      })
    ).toBe(false);

    expect(migration121).toMatch(/onboard_clinic_entitlement_subscription/);
    expect(migration121).toMatch(/key = 'trial'/);
    expect(migration121).toMatch(/'trialing'/);
    expect(migration121).toMatch(/AFTER INSERT ON public\.clinics/);
    expect(migration121).not.toMatch(
      /onboard_clinic_entitlement_subscription[\s\S]*key = 'legacy'/
    );
    expect(migration121).toMatch(/ONBOARDING_PLAN_FORBIDDEN/);
  });
});

describe("Phase 30 acceptance — plan feature", () => {
  it("enabled → true", () => {
    const resolved = resolveFeatureEntitlement({
      feature: cashRegister,
      planFeature: { enabled: true, value: null },
    });
    expect(resolved.enabled).toBe(true);
    expect(resolved.source).toBe("plan");
    expect(canUseResolvedEntitlement(resolved)).toBe(true);
  });

  it("disabled → false", () => {
    const resolved = resolveFeatureEntitlement({
      feature: cashRegister,
      planFeature: { enabled: false, value: null },
    });
    expect(resolved.enabled).toBe(false);
    expect(canUseResolvedEntitlement(resolved)).toBe(false);
  });
});

describe("Phase 30 acceptance — override", () => {
  it("plan false + override true → true", () => {
    const resolved = resolveFeatureEntitlement({
      feature: cashRegister,
      planFeature: { enabled: false, value: null },
      override: { enabled: true, value: null, startsAt: null, endsAt: null },
    });
    expect(resolved.enabled).toBe(true);
    expect(resolved.source).toBe("override");
  });

  it("plan true + override false → false", () => {
    const resolved = resolveFeatureEntitlement({
      feature: cashRegister,
      planFeature: { enabled: true, value: null },
      override: { enabled: false, value: null, startsAt: null, endsAt: null },
    });
    expect(resolved.enabled).toBe(false);
    expect(resolved.source).toBe("override");
  });
});

describe("Phase 30 acceptance — limits", () => {
  it("plan limit 100 → 100", () => {
    const resolved = resolveFeatureEntitlement({
      feature: aiRequests,
      planFeature: { enabled: true, value: 100 },
    });
    expect(getResolvedFeatureLimit(resolved)).toBe(100);
  });

  it("override 500 → 500", () => {
    const resolved = resolveFeatureEntitlement({
      feature: aiRequests,
      planFeature: { enabled: true, value: 100 },
      override: { enabled: true, value: 500, startsAt: null, endsAt: null },
    });
    expect(getResolvedFeatureLimit(resolved)).toBe(500);
  });

  it("unlimited → null", () => {
    const resolved = resolveFeatureEntitlement({
      feature: aiRequests,
      planFeature: { enabled: true, value: null },
    });
    expect(getResolvedFeatureLimit(resolved)).toBeNull();
  });

  it("disabled → 0", () => {
    const resolved = resolveFeatureEntitlement({
      feature: aiRequests,
      planFeature: { enabled: false, value: 100 },
    });
    expect(getResolvedFeatureLimit(resolved)).toBe(0);
  });
});

describe("Phase 30 acceptance — temporary overrides", () => {
  const now = new Date("2026-08-19T12:00:00.000Z");

  it("active → applied", () => {
    const resolved = resolveFeatureEntitlement({
      feature: cashRegister,
      planFeature: { enabled: false, value: null },
      override: {
        enabled: true,
        value: null,
        startsAt: "2026-08-01T00:00:00.000Z",
        endsAt: "2026-09-01T00:00:00.000Z",
      },
      now,
    });
    expect(resolved.source).toBe("override");
    expect(resolved.enabled).toBe(true);
  });

  it("expired → ignored", () => {
    const resolved = resolveFeatureEntitlement({
      feature: cashRegister,
      planFeature: { enabled: false, value: null },
      override: {
        enabled: true,
        value: null,
        startsAt: "2020-01-01T00:00:00.000Z",
        endsAt: "2020-02-01T00:00:00.000Z",
      },
      now,
    });
    expect(resolved.source).toBe("plan");
    expect(resolved.enabled).toBe(false);
  });

  it("future → ignored", () => {
    const resolved = resolveFeatureEntitlement({
      feature: cashRegister,
      planFeature: { enabled: false, value: null },
      override: {
        enabled: true,
        value: null,
        startsAt: "2026-09-01T00:00:00.000Z",
        endsAt: "2026-10-01T00:00:00.000Z",
      },
      now,
    });
    expect(resolved.source).toBe("plan");
    expect(resolved.enabled).toBe(false);
  });
});

describe("Phase 30 acceptance — unknown feature", () => {
  it("DENY", () => {
    const resolved = resolveFeatureEntitlement({ feature: null });
    expect(resolved.source).toBe("deny");
    expect(canUseResolvedEntitlement(resolved)).toBe(false);

    const inactive = resolveFeatureEntitlement({
      feature: { ...cashRegister, isActive: false },
      planFeature: { enabled: true, value: null },
    });
    expect(inactive.source).toBe("deny");
  });
});

describe("Phase 30 acceptance — usage", () => {
  it("positive increment → allowed", () => {
    expect(decideUsageIncrement(meteredBase)).toEqual({ ok: true, nextAmount: 11 });
  });

  it("0 → rejected", () => {
    expect(decideUsageIncrement({ ...meteredBase, amount: 0 }).error).toBe("INVALID_AMOUNT");
  });

  it("negative → rejected", () => {
    expect(decideUsageIncrement({ ...meteredBase, amount: -1 }).error).toBe("INVALID_AMOUNT");
  });

  it("unknown feature → rejected", () => {
    expect(decideUsageIncrement({ ...meteredBase, featureKnown: false }).error).toBe(
      "UNKNOWN_FEATURE"
    );
  });

  it("non-metered feature → rejected", () => {
    expect(decideUsageIncrement({ ...meteredBase, metered: false }).error).toBe(
      "FEATURE_NOT_METERED"
    );
  });
});

describe("Phase 30 acceptance — concurrency", () => {
  it("concurrent usage increments must not lose updates", async () => {
    const ledger = new AtomicUsageLedger();
    const key = `${FEATURES.AI_MONTHLY_REQUESTS}:${clinicA}`;
    const results = await Promise.all(
      Array.from({ length: 100 }, () =>
        ledger.consume(key, {
          amount: 1,
          limit: 1000,
          metered: true,
          featureKnown: true,
          featureActive: true,
        })
      )
    );
    expect(results.every((r) => r.ok)).toBe(true);
    expect(ledger.get(key)).toBe(100);
  });
});

describe("Phase 30 acceptance — tenant isolation", () => {
  it("Organization A cannot read Organization B (session clinic)", () => {
    expect(resolveTrustedClinicId(clinicA, clinicB)).toBeNull();
    expect(resolveTrustedClinicId(clinicA, clinicA)).toBe(clinicA);
    expect(resolveTrustedClinicId(null, clinicB)).toBeNull();
  });

  it("Organization A cannot modify Organization B (RLS + access assert in SQL)", () => {
    expect(migration121).toMatch(/assert_entitlement_clinic_access/);
    expect(migration121).toMatch(
      /CREATE OR REPLACE FUNCTION public\.assert_entitlement_clinic_access/
    );
    expect(migration121).toMatch(/user_role_in_clinic\(p_clinic_id\)/);
    // Authenticated may SELECT own clinic rows only — no INSERT/UPDATE/DELETE policies.
    expect(migration121).toMatch(/clinic_id IN \(SELECT user_clinic_ids\(\)\)/);
    expect(migration121).not.toMatch(
      /CREATE POLICY \w+ ON public\.clinic_feature_overrides\s+FOR INSERT/i
    );
    expect(migration121).not.toMatch(
      /CREATE POLICY \w+ ON public\.feature_usage\s+FOR (INSERT|UPDATE|DELETE)/i
    );
  });

  it("Organization A cannot consume quota for Organization B", async () => {
    expect(migration121).toMatch(
      /try_consume_feature_usage[\s\S]*?assert_entitlement_clinic_access\(p_clinic_id\)/
    );
    expect(migration121).toMatch(
      /increment_feature_usage[\s\S]*?assert_entitlement_clinic_access\(p_clinic_id\)/
    );
    expect(migration121).toMatch(
      /get_clinic_entitlements[\s\S]*?assert_entitlement_clinic_access\(p_clinic_id\)/
    );

    const ledger = new AtomicUsageLedger();
    const keyA = `${FEATURES.AI_MONTHLY_REQUESTS}:${clinicA}`;
    const keyB = `${FEATURES.AI_MONTHLY_REQUESTS}:${clinicB}`;
    await ledger.consume(keyA, {
      amount: 7,
      limit: 100,
      metered: true,
      featureKnown: true,
      featureActive: true,
    });
    expect(ledger.get(keyA)).toBe(7);
    expect(ledger.get(keyB)).toBe(0);

    // Client cannot spoof another org id when session is A.
    expect(resolveTrustedClinicId(clinicA, clinicB)).toBeNull();
  });

  it("legacy/active snapshot for A does not grant B identity", () => {
    const snapshotA = toClientEntitlementsSnapshot({
      clinicId: clinicA,
      planKey: PLAN_KEYS.LEGACY,
      planId: "plan-legacy",
      status: "active",
      trialEndsAt: null,
      catalogAvailable: true,
      features: {
        [FEATURES.CASH_REGISTER]: {
          enabled: true,
          limit: null,
          source: "plan",
          featureType: "boolean",
        },
      },
      usage: {},
      usagePeriodStart: null,
    });
    expect(snapshotA.planKey).toBe(PLAN_KEYS.LEGACY);
    expect(resolveTrustedClinicId(clinicA, clinicB)).toBeNull();
  });
});
