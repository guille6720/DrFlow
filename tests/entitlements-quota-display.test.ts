import { describe, expect, it } from "vitest";

import { remainingSeatHeadroom } from "@/core/entitlements/limits";
import {
  consumePatientCreateHeadroom,
  formatQuotaLabel,
  shouldAllowBulkPatientCreate,
  shouldAllowPatientCreate,
} from "@/core/entitlements/quota-display";

describe("Phase 4 quota display", () => {
  it("formats unlimited, included and excluded limits", () => {
    expect(formatQuotaLabel(12, null)).toBe("12 / ilimitado");
    expect(formatQuotaLabel(0, 0)).toBe("no incluido");
    expect(formatQuotaLabel(3, 10)).toBe("3 / 10");
  });

  it("allows creates while headroom remains", () => {
    expect(shouldAllowPatientCreate(null)).toBe(true);
    expect(shouldAllowPatientCreate(1)).toBe(true);
    expect(shouldAllowPatientCreate(0)).toBe(false);
    expect(consumePatientCreateHeadroom(2, true)).toBe(1);
    expect(consumePatientCreateHeadroom(null, true)).toBe(null);
    expect(consumePatientCreateHeadroom(2, false)).toBe(2);
  });

  it("treats missing catalog as unlimited headroom", () => {
    expect(remainingSeatHeadroom(false, true, 1, 99)).toBeNull();
    expect(remainingSeatHeadroom(true, true, null, 99)).toBeNull();
    expect(remainingSeatHeadroom(true, true, 500, 498)).toBe(2);
    expect(remainingSeatHeadroom(true, true, 3, 3)).toBe(0);
  });

  it("allows demo seed when headroom covers new patients", () => {
    expect(shouldAllowBulkPatientCreate(null, 12)).toBe(true);
    expect(shouldAllowBulkPatientCreate(12, 12)).toBe(true);
    expect(shouldAllowBulkPatientCreate(5, 12)).toBe(false);
    expect(shouldAllowBulkPatientCreate(0, 0)).toBe(true);
    expect(shouldAllowBulkPatientCreate(0, null)).toBe(false);
    expect(shouldAllowBulkPatientCreate(3, null)).toBe(true);
  });
});
