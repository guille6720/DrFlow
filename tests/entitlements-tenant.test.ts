import { describe, expect, it } from "vitest";

import {
  isInternalOrLegacyPlan,
  isPlanAssignableOnOnboarding,
  MIGRATION_PLAN_KEY,
  ONBOARDING_PLAN_KEY,
  PLAN_KEYS,
} from "@/core/entitlements/plan-keys";
import { resolveTrustedClinicId } from "@/core/entitlements/trusted-clinic";

describe("legacy vs trial assignment policy", () => {
  it("existing organization mapping is legacy + active", () => {
    expect(MIGRATION_PLAN_KEY).toBe("legacy");
    expect(isInternalOrLegacyPlan({
      key: PLAN_KEYS.LEGACY,
      is_internal: true,
      is_public: false,
      metadata: { internal: true, migration_only: true, assignable_only_by_superadmin: true },
    })).toBe(true);
    expect(
      isPlanAssignableOnOnboarding({
        key: PLAN_KEYS.LEGACY,
        is_internal: true,
        is_public: false,
      })
    ).toBe(false);
  });

  it("new organization mapping is trial + trialing and never legacy", () => {
    expect(ONBOARDING_PLAN_KEY).toBe("trial");
    expect(
      isPlanAssignableOnOnboarding({
        key: PLAN_KEYS.TRIAL,
        is_internal: false,
        is_public: true,
        metadata: { trial_duration_days: null },
      })
    ).toBe(true);
    expect(ONBOARDING_PLAN_KEY).not.toBe(PLAN_KEYS.LEGACY);
  });

  it("rejects internal plans on automatic onboarding", () => {
    expect(
      isPlanAssignableOnOnboarding({
        key: "enterprise",
        is_internal: true,
        is_public: false,
      })
    ).toBe(false);
  });
});

describe("tenant isolation of clinic identity", () => {
  const clinicA = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
  const clinicB = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

  it("uses session clinic when the client omits organization_id", () => {
    expect(resolveTrustedClinicId(clinicA, undefined)).toBe(clinicA);
  });

  it("denies a client-supplied organization_id for another clinic", () => {
    expect(resolveTrustedClinicId(clinicA, clinicB)).toBeNull();
  });

  it("denies usage when there is no authenticated clinic context", () => {
    expect(resolveTrustedClinicId(null, clinicB)).toBeNull();
  });

  it("does not let clinic A masquerade as clinic B for reads or consume", () => {
    expect(resolveTrustedClinicId(clinicA, clinicB)).toBeNull();
    expect(resolveTrustedClinicId(clinicB, clinicA)).toBeNull();
    expect(resolveTrustedClinicId(clinicA, clinicA)).toBe(clinicA);
  });
});
