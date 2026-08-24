import type { BillingPlanId } from "@/core/billing/plans";
import { PLAN_KEYS, type PlanKey } from "@/core/entitlements/plan-keys";

/**
 * Adapter billing Mercado Pago → catálogo comercial.
 * Feature checks must still go through entitlements, never `if (plan === ...)`.
 * Historic SKUs map to legacy commercial tiers; Essential/Pro map 1:1.
 */
export const BILLING_TO_COMMERCIAL_PLAN = {
  essential: PLAN_KEYS.ESSENTIAL,
  pro: PLAN_KEYS.PRO,
  solo: PLAN_KEYS.BASIC,
  consultorio: PLAN_KEYS.PRO,
  clinica: PLAN_KEYS.PREMIUM,
} as const satisfies Record<BillingPlanId, PlanKey>;

export function commercialPlanKeyFromBillingPlan(planId: BillingPlanId): PlanKey {
  return BILLING_TO_COMMERCIAL_PLAN[planId];
}
