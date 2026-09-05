/**
 * Premium patients.max = unlimited (null); Basic remains capped.
 */
import { describe, expect, it } from "vitest";

import { FEATURES } from "@/core/entitlements/features";
import { decideSeatCapacity, remainingSeatHeadroom } from "@/core/entitlements/limits";
import {
  formatPatientQuotaLabel,
  formatQuotaLabel,
  resolvedFeatureLimit,
  shouldAllowBulkPatientCreate,
  shouldAllowPatientCreate,
} from "@/core/entitlements/quota-display";
import type { ResolvedFeatureEntitlement } from "@/core/entitlements/types";

const BASIC_PATIENTS_MAX = 500;

describe("Premium unlimited patients", () => {
  it("allows Premium (null) far beyond Basic's historic cap", () => {
    expect(
      decideSeatCapacity({
        enforced: true,
        catalogAvailable: true,
        limit: null,
        currentCount: BASIC_PATIENTS_MAX + 250,
        extra: 1,
        featureKey: FEATURES.PATIENTS_MAX,
      })
    ).toEqual({ ok: true });
  });

  it("blocks Basic at 500 and allows the 500th seat", () => {
    expect(
      decideSeatCapacity({
        enforced: true,
        catalogAvailable: true,
        limit: BASIC_PATIENTS_MAX,
        currentCount: BASIC_PATIENTS_MAX,
        featureKey: FEATURES.PATIENTS_MAX,
      }).ok
    ).toBe(false);

    expect(
      decideSeatCapacity({
        enforced: true,
        catalogAvailable: true,
        limit: BASIC_PATIENTS_MAX,
        currentCount: BASIC_PATIENTS_MAX - 1,
        featureKey: FEATURES.PATIENTS_MAX,
      })
    ).toEqual({ ok: true });
  });

  it("import/create headroom is unlimited for Premium and finite for Basic", () => {
    expect(remainingSeatHeadroom(true, true, null, 10_000)).toBeNull();
    expect(shouldAllowPatientCreate(null)).toBe(true);
    expect(shouldAllowBulkPatientCreate(null, 2000)).toBe(true);

    expect(remainingSeatHeadroom(true, true, BASIC_PATIENTS_MAX, 500)).toBe(0);
    expect(shouldAllowPatientCreate(0)).toBe(false);
    expect(shouldAllowBulkPatientCreate(0, 1)).toBe(false);
  });

  it("UI shows Pacientes ilimitados for Premium null without collapsing to 0", () => {
    const unlimited: ResolvedFeatureEntitlement = {
      enabled: true,
      limit: null,
      source: "plan",
      featureType: "limit",
    };
    expect(resolvedFeatureLimit(unlimited)).toBeNull();
    expect(resolvedFeatureLimit(undefined)).toBe(0);
    expect(formatPatientQuotaLabel(812, null)).toBe("Pacientes ilimitados");
    expect(formatPatientQuotaLabel(500, BASIC_PATIENTS_MAX)).toBe("500 / 500");
    // Non-patient quotas keep the generic "N / ilimitado" wording.
    expect(formatQuotaLabel(3, null)).toBe("3 / ilimitado");
  });
});
