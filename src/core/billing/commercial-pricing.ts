/**
 * Commercial Essential/Pro pricing — promotional window of 6 billing months.
 * Effective price is always resolved server-side from subscription snapshot + catalog.
 */

export const PROMO_BILLING_MONTHS = 6 as const;

export type CommercialSkuId = "essential" | "pro";

export type CommercialSkuPricing = {
  id: CommercialSkuId;
  displayName: string;
  tagline: string;
  promoPriceArs: number;
  regularPriceArs: number;
  promoMonths: typeof PROMO_BILLING_MONTHS;
  currency: "ARS";
};

/** Public commercial SKUs (monthly). */
export const COMMERCIAL_SKU_PRICING: Record<CommercialSkuId, CommercialSkuPricing> = {
  essential: {
    id: "essential",
    displayName: "NexClinic Essential",
    tagline:
      "Para profesionales independientes que necesitan gestionar su consultorio de forma simple y segura.",
    promoPriceArs: 25_000,
    regularPriceArs: 35_000,
    promoMonths: PROMO_BILLING_MONTHS,
    currency: "ARS",
  },
  pro: {
    id: "pro",
    displayName: "NexClinic Pro",
    tagline:
      "Para consultorios y equipos médicos que buscan automatización, IA y mayor capacidad.",
    promoPriceArs: 40_000,
    regularPriceArs: 55_000,
    promoMonths: PROMO_BILLING_MONTHS,
    currency: "ARS",
  },
};

export function isCommercialSkuId(planId: string): planId is CommercialSkuId {
  return planId === "essential" || planId === "pro";
}

/**
 * Add N calendar billing months (not 180 hard-coded days).
 * Uses local Date month arithmetic; callers should pass/store UTC ISO consistently.
 */
export function addBillingMonths(from: Date, months: number): Date {
  const d = new Date(from.getTime());
  const day = d.getUTCDate();
  d.setUTCMonth(d.getUTCMonth() + months);
  // Clamp month overflow (e.g. Jan 31 + 1 month)
  if (d.getUTCDate() < day) {
    d.setUTCDate(0);
  }
  return d;
}

export function computePromoWindow(activatedAt: Date, promoMonths = PROMO_BILLING_MONTHS): {
  promoStartedAt: Date;
  promoEndsAt: Date;
} {
  const promoStartedAt = new Date(activatedAt.getTime());
  const promoEndsAt = addBillingMonths(promoStartedAt, promoMonths);
  return { promoStartedAt, promoEndsAt };
}

export type PromoSnapshotInput = {
  planId: CommercialSkuId;
  promoStartedAt: string | Date | null | undefined;
  promoEndsAt: string | Date | null | undefined;
  promoPriceArs: number | null | undefined;
  regularPriceArs: number | null | undefined;
  /** Evaluation instant (default now). */
  at?: Date;
};

export type EffectivePriceResult = {
  amountArs: number;
  phase: "promotional" | "regular";
  promoEndsAt: string | null;
  currency: "ARS";
};

function toDate(value: string | Date | null | undefined): Date | null {
  if (value == null) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isFinite(d.getTime()) ? d : null;
}

/**
 * Resolve price for checkout/webhook.
 * Prefer persisted snapshot amounts; fall back to catalog for the plan.
 * Promotional if `at < promoEndsAt` when a window exists; otherwise regular.
 * New subscriptions without snapshot yet use catalog promo (first payment).
 */
export function resolveEffectivePrice(input: PromoSnapshotInput): EffectivePriceResult | null {
  if (!isCommercialSkuId(input.planId)) return null;
  const catalog = COMMERCIAL_SKU_PRICING[input.planId];
  const promoPrice = input.promoPriceArs ?? catalog.promoPriceArs;
  const regularPrice = input.regularPriceArs ?? catalog.regularPriceArs;
  const at = input.at ?? new Date();
  const ends = toDate(input.promoEndsAt);

  if (ends && at.getTime() < ends.getTime()) {
    return {
      amountArs: promoPrice,
      phase: "promotional",
      promoEndsAt: ends.toISOString(),
      currency: "ARS",
    };
  }

  if (ends && at.getTime() >= ends.getTime()) {
    return {
      amountArs: regularPrice,
      phase: "regular",
      promoEndsAt: ends.toISOString(),
      currency: "ARS",
    };
  }

  // No window yet (first purchase): promotional catalog price.
  return {
    amountArs: promoPrice,
    phase: "promotional",
    promoEndsAt: null,
    currency: "ARS",
  };
}

/** Build snapshot fields for a brand-new paid activation (starts promo clock). */
export function buildNewSubscriptionPromoSnapshot(
  planId: CommercialSkuId,
  activatedAt = new Date()
): {
  promo_started_at: string;
  promo_ends_at: string;
  promo_months: number;
  promo_price_amount: number;
  regular_price_amount: number;
  price_currency: "ARS";
} {
  const catalog = COMMERCIAL_SKU_PRICING[planId];
  const { promoStartedAt, promoEndsAt } = computePromoWindow(activatedAt, catalog.promoMonths);
  return {
    promo_started_at: promoStartedAt.toISOString(),
    promo_ends_at: promoEndsAt.toISOString(),
    promo_months: catalog.promoMonths,
    promo_price_amount: catalog.promoPriceArs,
    regular_price_amount: catalog.regularPriceArs,
    price_currency: "ARS",
  };
}

/**
 * Upgrade Essential → Pro: keep ORIGINAL promo_ends_at; refresh prices to Pro catalog.
 * Does not restart a new 6-month window.
 */
export function buildUpgradeProPromoFields(existing: {
  promo_started_at: string | null;
  promo_ends_at: string | null;
  promo_months: number | null;
}): {
  promo_price_amount: number;
  regular_price_amount: number;
  promo_started_at: string | null;
  promo_ends_at: string | null;
  promo_months: number;
  price_currency: "ARS";
} {
  const pro = COMMERCIAL_SKU_PRICING.pro;
  return {
    promo_price_amount: pro.promoPriceArs,
    regular_price_amount: pro.regularPriceArs,
    promo_started_at: existing.promo_started_at,
    promo_ends_at: existing.promo_ends_at,
    promo_months: existing.promo_months ?? pro.promoMonths,
    price_currency: "ARS",
  };
}

export function formatPromoCopyEs(planId: CommercialSkuId): {
  currentPromoLine: string;
  thenRegularLine: string;
} {
  const p = COMMERCIAL_SKU_PRICING[planId];
  const promo = p.promoPriceArs.toLocaleString("es-AR");
  const regular = p.regularPriceArs.toLocaleString("es-AR");
  return {
    currentPromoLine: `$${promo}/mes durante los primeros ${p.promoMonths} meses`,
    thenRegularLine: `Luego $${regular}/mes`,
  };
}
