/**
 * Upgrade / downgrade rules for Essential ↔ Pro (server-side).
 * Cancel remains in subscription-service (paid-through).
 */

import { type CommercialSkuId, isCommercialSkuId } from "@/core/billing/commercial-pricing";
import type { BillingPlanId } from "@/core/billing/plans";

export type PlanChangeKind = "upgrade" | "downgrade" | "same" | "switch_from_legacy";

export function classifyPlanChange(
  from: BillingPlanId | null | undefined,
  to: BillingPlanId
): PlanChangeKind {
  if (!from || from === to) return "same";
  if (!isCommercialSkuId(to)) return "same";
  if (!isCommercialSkuId(from)) return "switch_from_legacy";
  if (from === "essential" && to === "pro") return "upgrade";
  if (from === "pro" && to === "essential") return "downgrade";
  return "same";
}

/** Downgrade Pro → Essential blocked while more than 1 active professional. */
export function evaluateDowngradeToEssential(input: {
  activeProfessionals: number;
}): { ok: true } | { ok: false; error: string } {
  if (input.activeProfessionals > 1) {
    return {
      ok: false,
      error:
        "No podés pasar a Essential mientras tengas más de 1 profesional activo. " +
        "Desactivá profesionales excedentes o quedate en Pro. No se borran datos clínicos.",
    };
  }
  return { ok: true };
}

export function professionalsIncludedMessage(planId: CommercialSkuId): string {
  if (planId === "essential") return "Tu plan incluye 1 profesional.";
  return "Tu plan incluye hasta 5 profesionales.";
}

export function shouldPreservePromoWindowOnUpgrade(kind: PlanChangeKind): boolean {
  return kind === "upgrade";
}
