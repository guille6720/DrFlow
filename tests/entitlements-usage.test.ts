import { describe, expect, it } from "vitest";

import { FEATURES } from "@/core/entitlements/features";
import { AtomicUsageLedger, decideUsageConsume, decideUsageIncrement } from "@/core/entitlements/usage-consume";
import { isPositiveUsageAmount } from "@/core/entitlements/usage-period";

const meteredBase = {
  currentAmount: 10,
  amount: 1,
  limit: 100,
  metered: true,
  featureKnown: true,
  featureActive: true,
};

describe("usage amount validation", () => {
  it("allows positive increment", () => {
    expect(isPositiveUsageAmount(1)).toBe(true);
    expect(decideUsageIncrement(meteredBase)).toEqual({ ok: true, nextAmount: 11 });
  });

  it("rejects zero and negative amounts", () => {
    expect(decideUsageIncrement({ ...meteredBase, amount: 0 }).error).toBe("INVALID_AMOUNT");
    expect(decideUsageIncrement({ ...meteredBase, amount: -5 }).error).toBe("INVALID_AMOUNT");
  });

  it("rejects unknown and non-metered features", () => {
    expect(decideUsageIncrement({ ...meteredBase, featureKnown: false }).error).toBe(
      "UNKNOWN_FEATURE"
    );
    expect(decideUsageIncrement({ ...meteredBase, metered: false }).error).toBe(
      "FEATURE_NOT_METERED"
    );
    expect(decideUsageIncrement({ ...meteredBase, featureActive: false }).error).toBe(
      "FEATURE_INACTIVE"
    );
  });
});

describe("try_consume quota", () => {
  it("consumes when under limit", () => {
    expect(decideUsageConsume(meteredBase)).toEqual({ ok: true, nextAmount: 11 });
  });

  it("rejects when quota would be exceeded", () => {
    expect(
      decideUsageConsume({ ...meteredBase, currentAmount: 100, amount: 1, limit: 100 }).error
    ).toBe("QUOTA_EXCEEDED");
  });

  it("allows unlimited (null) quota", () => {
    expect(decideUsageConsume({ ...meteredBase, limit: null })).toEqual({
      ok: true,
      nextAmount: 11,
    });
  });
});

describe("concurrent usage increments", () => {
  it("does not lose updates when many consumes run in parallel", async () => {
    const ledger = new AtomicUsageLedger();
    const key = `${FEATURES.AI_MONTHLY_REQUESTS}:clinic-a`;
    const results = await Promise.all(
      Array.from({ length: 50 }, () =>
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
    expect(ledger.get(key)).toBe(50);
  });

  it("serializes consume against the same quota so the last units are not double-spent", async () => {
    const ledger = new AtomicUsageLedger();
    const key = `${FEATURES.WHATSAPP_MONTHLY_MESSAGES}:clinic-a`;
    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        ledger.consume(key, {
          amount: 1,
          limit: 5,
          metered: true,
          featureKnown: true,
          featureActive: true,
        })
      )
    );
    const accepted = results.filter((r) => r.ok);
    const rejected = results.filter((r) => !r.ok);
    expect(accepted).toHaveLength(5);
    expect(rejected).toHaveLength(5);
    expect(ledger.get(key)).toBe(5);
  });
});
