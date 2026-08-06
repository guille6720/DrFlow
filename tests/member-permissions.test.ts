import { describe, expect, it } from "vitest";

import {
  computeOverrideOnToggle,
  getEffectivePermissionsForRole,
} from "@/core/permissions/member-permissions";
import { hasPermission } from "@/core/permissions/roles";

describe("member permission overrides", () => {
  it("grants secretary access to clinical records when overridden", () => {
    expect(hasPermission("secretary", "viewClinicalRecords")).toBe(false);
    expect(
      hasPermission("secretary", "viewClinicalRecords", false, {
        viewClinicalRecords: true,
      })
    ).toBe(true);
  });

  it("revokes doctor cash access when overridden", () => {
    expect(hasPermission("doctor", "manageCashRegister")).toBe(true);
    expect(
      hasPermission("doctor", "manageCashRegister", false, {
        manageCashRegister: false,
      })
    ).toBe(false);
  });

  it("clears override when toggled back to role default", () => {
    expect(computeOverrideOnToggle("secretary", "viewClinicalRecords", true)).toBe(true);
    expect(computeOverrideOnToggle("secretary", "viewClinicalRecords", false)).toBe(null);
  });

  it("computes effective matrix for a role", () => {
    const effective = getEffectivePermissionsForRole("secretary", {
      viewClinicalRecords: true,
    });
    expect(effective.viewClinicalRecords).toBe(true);
    expect(effective.managePatients).toBe(true);
    expect(effective.issuePrescriptions).toBe(false);
  });
});
