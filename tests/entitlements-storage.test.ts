import { describe, expect, it } from "vitest";

import { BYTES_PER_MB, bytesToMb, decideStorageCapacity } from "@/core/entitlements/storage";

describe("Phase 5 storage capacity", () => {
  it("fails open when the catalog is missing", () => {
    expect(
      decideStorageCapacity({
        enforced: true,
        catalogAvailable: false,
        limitMb: 1,
        currentBytes: 99 * BYTES_PER_MB,
        extraBytes: BYTES_PER_MB,
      })
    ).toEqual({ ok: true });
  });

  it("allows unlimited and missing limits", () => {
    expect(
      decideStorageCapacity({
        enforced: true,
        catalogAvailable: true,
        limitMb: null,
        currentBytes: 50 * BYTES_PER_MB,
        extraBytes: BYTES_PER_MB,
      })
    ).toEqual({ ok: true });
  });

  it("blocks when the upload would exceed the cap", () => {
    const denied = decideStorageCapacity({
      enforced: true,
      catalogAvailable: true,
      limitMb: 1,
      currentBytes: BYTES_PER_MB,
      extraBytes: 1,
    });
    expect(denied.ok).toBe(false);
  });

  it("allows the last remaining bytes", () => {
    expect(
      decideStorageCapacity({
        enforced: true,
        catalogAvailable: true,
        limitMb: 1,
        currentBytes: BYTES_PER_MB - 10,
        extraBytes: 10,
      })
    ).toEqual({ ok: true });
  });

  it("ceils bytes to megabytes for display", () => {
    expect(bytesToMb(0)).toBe(0);
    expect(bytesToMb(1)).toBe(1);
    expect(bytesToMb(BYTES_PER_MB)).toBe(1);
  });
});
