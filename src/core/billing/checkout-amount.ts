import "server-only";

import {
  type CommercialSkuId,
  isCommercialSkuId,
  resolveEffectivePrice,
} from "@/core/billing/commercial-pricing";
import type { BillingPlanId } from "@/core/billing/plans";
import { type BillingCycle, getPlanPriceArs } from "@/core/billing/plans";
import { createAdminClient, hasAdminClient } from "@/core/supabase/admin";
import { createClient } from "@/core/supabase/server";

export type SubscriptionPromoSnapshot = {
  plan_id: BillingPlanId;
  promo_started_at: string | null;
  promo_ends_at: string | null;
  promo_months: number | null;
  promo_price_amount: number | null;
  regular_price_amount: number | null;
};

export async function loadSubscriptionPromoSnapshot(
  clinicId: string,
  useAdmin = false
): Promise<SubscriptionPromoSnapshot | null> {
  const client = useAdmin && hasAdminClient() ? createAdminClient() : await createClient();
  const { data } = await client
    .from("clinic_subscriptions")
    .select(
      "plan_id, promo_started_at, promo_ends_at, promo_months, promo_price_amount, regular_price_amount"
    )
    .eq("clinic_id", clinicId)
    .maybeSingle();
  return (data as SubscriptionPromoSnapshot | null) ?? null;
}

/**
 * Server amount for MP preference / webhook validation.
 * Commercial SKUs use promo snapshot; historic SKUs use fixed catalog.
 */
export function resolveCheckoutAmountArs(input: {
  planId: BillingPlanId;
  cycle: BillingCycle;
  snapshot?: SubscriptionPromoSnapshot | null;
  at?: Date;
}): number | null {
  if (isCommercialSkuId(input.planId)) {
    if (input.cycle === "annual") return null;
    const snap = input.snapshot;
    const samePlanSnap =
      snap && isCommercialSkuId(snap.plan_id) && snap.plan_id === input.planId ? snap : null;
    // Upgrade to Pro: reuse promo window dates from existing, but Pro catalog prices
    const upgradeFromEssential =
      snap &&
      snap.plan_id === "essential" &&
      input.planId === "pro" &&
      snap.promo_ends_at;

    const effective = resolveEffectivePrice({
      planId: input.planId as CommercialSkuId,
      promoStartedAt: upgradeFromEssential
        ? snap!.promo_started_at
        : samePlanSnap?.promo_started_at,
      promoEndsAt: upgradeFromEssential ? snap!.promo_ends_at : samePlanSnap?.promo_ends_at,
      promoPriceArs: samePlanSnap?.promo_price_amount,
      regularPriceArs: samePlanSnap?.regular_price_amount,
      at: input.at,
    });
    return effective?.amountArs ?? null;
  }
  return getPlanPriceArs(input.planId, input.cycle);
}
