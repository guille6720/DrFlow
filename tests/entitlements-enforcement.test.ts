import { describe, expect, it } from "vitest";

import { ADMIN_OVERRIDE_FEATURE_KEYS } from "@/core/entitlements/admin-constants";
import {
  ADDON_GATED_FEATURES,
  CORE_UNGATED_FEATURES,
  ENTITLEMENT_ENFORCEMENT_ENABLED,
  EXISTING_MODULE_ENFORCEMENT_DEFERRED,
  isAddonGatedFeature,
  isAutomationLimitEnforced,
  isCoreUngatedFeature,
  isExistingModuleEnforcementDeferred,
  isFeatureEnforced,
  isSeatLimitEnforced,
  isStorageLimitEnforced,
} from "@/core/entitlements/enforcement";
import { FEATURES } from "@/core/entitlements/features";
import { emptyEntitlements, toClientEntitlementsSnapshot } from "@/core/entitlements/resolve";
import { isFeatureEntitledBySnapshot } from "@/core/entitlements/snapshot-access";
import type { ClientEntitlementsSnapshot } from "@/core/entitlements/types";

describe("entitlement enforcement", () => {
  it("keeps progressive enforcement on without gating core clinical", () => {
    expect(ENTITLEMENT_ENFORCEMENT_ENABLED).toBe(true);
    expect(isFeatureEnforced(FEATURES.PATIENTS)).toBe(false);
    expect(isFeatureEnforced(FEATURES.APPOINTMENTS)).toBe(false);
    expect(isFeatureEnforced(FEATURES.CLINICAL_HISTORY)).toBe(false);
    expect(isFeatureEnforced(FEATURES.CONSULTATIONS)).toBe(false);
    expect(isFeatureEnforced(FEATURES.MEDICAL_ORDERS)).toBe(false);
    expect(isFeatureEnforced(FEATURES.DOCUMENTS)).toBe(false);
    expect(isFeatureEnforced(FEATURES.BASIC_REPORTS)).toBe(false);
    expect(isFeatureEnforced(FEATURES.DASHBOARD)).toBe(false);
  });

  it("does not enforce existing production modules deferred in phase 29", () => {
    expect(isExistingModuleEnforcementDeferred(FEATURES.PAMI)).toBe(true);
    expect(isExistingModuleEnforcementDeferred(FEATURES.ADVANCED_REPORTS)).toBe(true);
    expect(isFeatureEnforced(FEATURES.PAMI)).toBe(false);
    expect(isFeatureEnforced(FEATURES.ADVANCED_REPORTS)).toBe(false);

    const denied: ClientEntitlementsSnapshot = {
      catalogAvailable: true,
      planKey: "basic",
      status: "active",
      allowed: { [FEATURES.PAMI]: false, [FEATURES.ADVANCED_REPORTS]: false },
      usage: {},
      limits: {},
    };
    expect(isFeatureEntitledBySnapshot(FEATURES.PAMI, denied)).toBe(true);
    expect(isFeatureEntitledBySnapshot(FEATURES.ADVANCED_REPORTS, denied)).toBe(true);
  });

  it("still gates commercial add-ons that are not deferred", () => {
    expect(isFeatureEnforced(FEATURES.AI)).toBe(true);
    expect(isFeatureEnforced(FEATURES.WHATSAPP_REMINDERS)).toBe(true);
    expect(isFeatureEnforced(FEATURES.DATA_EXPORT)).toBe(true);
    expect(isFeatureEnforced(FEATURES.CASH_REGISTER)).toBe(true);
    expect(isFeatureEnforced(FEATURES.PHARMACOLOGY)).toBe(true);
    expect(isFeatureEnforced(FEATURES.INSURANCE)).toBe(true);
    expect(isFeatureEnforced(FEATURES.API)).toBe(true);
    expect(isFeatureEnforced(FEATURES.PORTAL)).toBe(true);
    expect(isFeatureEnforced(FEATURES.PDF_EXPORT)).toBe(true);
    expect(isFeatureEnforced(FEATURES.INTEGRATIONS)).toBe(true);
    expect(ADMIN_OVERRIDE_FEATURE_KEYS).toContain(FEATURES.PORTAL);
    expect(ADMIN_OVERRIDE_FEATURE_KEYS).toContain(FEATURES.PAMI);
    expect(ADMIN_OVERRIDE_FEATURE_KEYS).toContain(FEATURES.ADVANCED_REPORTS);
  });

  it("enforces seat caps without hiding core clinical modules", () => {
    expect(isFeatureEnforced(FEATURES.PATIENTS)).toBe(false);
    expect(isSeatLimitEnforced(FEATURES.PATIENTS_MAX)).toBe(true);
    expect(isSeatLimitEnforced(FEATURES.USERS_MAX)).toBe(true);
    expect(isSeatLimitEnforced(FEATURES.PROFESSIONALS_MAX)).toBe(true);
    expect(isSeatLimitEnforced(FEATURES.AI)).toBe(false);
    expect(isStorageLimitEnforced()).toBe(true);
    expect(isAutomationLimitEnforced()).toBe(true);
  });

  it("keeps core and addon catalogs disjoint for non-deferred keys", () => {
    for (const key of CORE_UNGATED_FEATURES) {
      expect(isCoreUngatedFeature(key)).toBe(true);
      expect(isAddonGatedFeature(key)).toBe(false);
      expect(isFeatureEnforced(key)).toBe(false);
    }
    for (const key of ADDON_GATED_FEATURES) {
      expect(isAddonGatedFeature(key)).toBe(true);
      expect(isCoreUngatedFeature(key)).toBe(false);
      if (isExistingModuleEnforcementDeferred(key)) {
        expect(isFeatureEnforced(key)).toBe(false);
      } else {
        expect(isFeatureEnforced(key)).toBe(true);
      }
    }
  });

  it("lists every phase-29 deferred existing module", () => {
    expect([...EXISTING_MODULE_ENFORCEMENT_DEFERRED]).toEqual(
      expect.arrayContaining([
        FEATURES.PATIENTS,
        FEATURES.CLINICAL_HISTORY,
        FEATURES.APPOINTMENTS,
        FEATURES.MEDICAL_ORDERS,
        FEATURES.DOCUMENTS,
        FEATURES.BASIC_REPORTS,
        FEATURES.PAMI,
        FEATURES.ADVANCED_REPORTS,
      ])
    );
  });

  it("fails open when the commercial catalog is missing", () => {
    const snapshot = toClientEntitlementsSnapshot(emptyEntitlements("clinic-id"));
    expect(snapshot.catalogAvailable).toBe(false);
    expect(snapshot.allowed).toEqual({});
    expect(snapshot.usage).toEqual({});
    expect(snapshot.status).toBeNull();
  });
});
