import { type FeatureKey, isMeteredFeature } from "@/core/entitlements/features";
import type { FeatureLimit } from "@/core/entitlements/types";
import { isPositiveUsageAmount } from "@/core/entitlements/usage-period";

export type UsageConsumeInput = {
  currentAmount: number;
  amount: number;
  limit: FeatureLimit;
  metered: boolean;
  featureKnown: boolean;
  featureActive: boolean;
};

export type UsageConsumeDecision =
  | { ok: true; nextAmount: number }
  | { ok: false; error: string };

export function decideUsageIncrement(input: UsageConsumeInput): UsageConsumeDecision {
  if (!input.featureKnown) return { ok: false, error: "UNKNOWN_FEATURE" };
  if (!input.featureActive) return { ok: false, error: "FEATURE_INACTIVE" };
  if (!input.metered) return { ok: false, error: "FEATURE_NOT_METERED" };
  if (!isPositiveUsageAmount(input.amount)) return { ok: false, error: "INVALID_AMOUNT" };
  return { ok: true, nextAmount: input.currentAmount + input.amount };
}

export function decideUsageConsume(input: UsageConsumeInput): UsageConsumeDecision {
  const increment = decideUsageIncrement(input);
  if (!increment.ok) return increment;
  if (input.limit === 0) return { ok: false, error: "FEATURE_DISABLED" };
  if (input.limit !== null && increment.nextAmount > input.limit) {
    return { ok: false, error: "QUOTA_EXCEEDED" };
  }
  return increment;
}

export function assertMeteredFeatureKey(featureKey: FeatureKey): boolean {
  return isMeteredFeature(featureKey);
}

/** In-memory atomic increment used to lock-step concurrent tests with SQL upsert semantics. */
export class AtomicUsageLedger {
  private amounts = new Map<string, number>();
  private queues = new Map<string, Promise<void>>();

  get(key: string): number {
    return this.amounts.get(key) ?? 0;
  }

  async consume(key: string, input: Omit<UsageConsumeInput, "currentAmount">): Promise<UsageConsumeDecision> {
    const previous = this.queues.get(key) ?? Promise.resolve();
    let release: () => void = () => undefined;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.queues.set(key, previous.then(() => current));
    await previous;
    try {
      const decision = decideUsageConsume({
        ...input,
        currentAmount: this.get(key),
      });
      if (decision.ok) this.amounts.set(key, decision.nextAmount);
      return decision;
    } finally {
      release();
    }
  }
}
