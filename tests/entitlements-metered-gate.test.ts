import { describe, expect, it } from "vitest";

import { decideMeteredUsageGate, isUsageRpcUnavailable } from "@/core/entitlements/metered-gate";

describe("Phase 3 metered usage gate", () => {
  it("fails open without catalog or consume RPC", () => {
    expect(
      decideMeteredUsageGate({
        enforced: true,
        catalogAvailable: false,
        rpcUnavailable: false,
        consumeOk: false,
        consumeError: "QUOTA_EXCEEDED",
      })
    ).toEqual({ ok: true });

    expect(
      decideMeteredUsageGate({
        enforced: true,
        catalogAvailable: true,
        rpcUnavailable: true,
        consumeOk: false,
        consumeError: "USAGE_RPC_UNAVAILABLE",
      })
    ).toEqual({ ok: true });
  });

  it("denies when the live catalog reports quota exceeded", () => {
    const denied = decideMeteredUsageGate({
      enforced: true,
      catalogAvailable: true,
      rpcUnavailable: false,
      consumeOk: false,
      consumeError: "QUOTA_EXCEEDED",
    });
    expect(denied.ok).toBe(false);
    if (!denied.ok) {
      expect(denied.error).toMatch(/límite de uso/);
    }
  });

  it("denies when SQL reports commercial suspension", () => {
    const denied = decideMeteredUsageGate({
      enforced: true,
      catalogAvailable: true,
      rpcUnavailable: false,
      consumeOk: false,
      consumeError: "COMMERCIAL_SUSPENDED",
    });
    expect(denied.ok).toBe(false);
    if (!denied.ok) {
      expect(denied.error).toMatch(/suspendido/);
    }
  });

  it("fails open on unexpected consume errors so clinical jobs keep running", () => {
    expect(
      decideMeteredUsageGate({
        enforced: true,
        catalogAvailable: true,
        rpcUnavailable: false,
        consumeOk: false,
        consumeError: "NOT_AUTHENTICATED",
      })
    ).toEqual({ ok: true });
  });

  it("detects missing usage RPCs", () => {
    expect(isUsageRpcUnavailable("USAGE_RPC_UNAVAILABLE")).toBe(true);
    expect(isUsageRpcUnavailable("Could not find the function try_consume_feature_usage")).toBe(
      true
    );
    expect(isUsageRpcUnavailable("QUOTA_EXCEEDED")).toBe(false);
  });
});
