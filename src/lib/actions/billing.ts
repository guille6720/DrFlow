"use server";

import { revalidatePath } from "next/cache";

import { requireClinicPermission, requireSettingsAccess } from "@/core/actions/clinic-guard";
import { getDashboardShell } from "@/core/auth/session.server";
import {
  loadSubscriptionPromoSnapshot,
  resolveCheckoutAmountArs,
} from "@/core/billing/checkout-amount";
import { createCheckoutPreference, isMercadoPagoConfigured } from "@/core/billing/mercadopago";
import {
  classifyPlanChange,
  evaluateDowngradeToEssential,
} from "@/core/billing/plan-change";
import {
  type BillingCycle,
  type BillingPlanId,
  getBillingPlan,
  isPlanAvailableForPurchase,
} from "@/core/billing/plans";
import { cancelClinicSubscriptionSelfServe } from "@/core/billing/subscription-service";
import { FEATURES } from "@/core/entitlements/features";
import { countClinicSeatRows } from "@/core/entitlements/limits.server";
import { createClient } from "@/core/supabase/server";

export type StartMercadoPagoCheckoutResult =
  | { ok: true; initPoint: string }
  | { ok: false; error: string };

export async function startMercadoPagoCheckout(
  planId: BillingPlanId,
  cycle: BillingCycle = "monthly"
): Promise<StartMercadoPagoCheckoutResult> {
  if (!isMercadoPagoConfigured()) {
    return {
      ok: false,
      error: "Mercado Pago no está configurado. Contactá a ventas para activar tu plan.",
    };
  }

  const access = await requireSettingsAccess();
  if (access.error || !access.clinicId) {
    return { ok: false, error: access.error ?? "Sin permisos para gestionar el plan." };
  }

  const plan = getBillingPlan(planId);
  if (!plan || !isPlanAvailableForPurchase(plan)) {
    return { ok: false, error: "Plan no disponible para compra online." };
  }

  const snapshot = await loadSubscriptionPromoSnapshot(access.clinicId);
  const changeKind = classifyPlanChange(snapshot?.plan_id, planId);

  if (changeKind === "downgrade") {
    const supabase = await createClient();
    const activeProfessionals = await countClinicSeatRows(
      supabase,
      FEATURES.PROFESSIONALS_MAX,
      access.clinicId
    );
    const downgrade = evaluateDowngradeToEssential({ activeProfessionals });
    if (!downgrade.ok) {
      return { ok: false, error: downgrade.error };
    }
  }

  const amountArs = resolveCheckoutAmountArs({
    planId,
    cycle,
    snapshot,
  });
  if (amountArs == null) {
    return { ok: false, error: "Precio no disponible para el ciclo seleccionado." };
  }

  const { clinic, profile } = await getDashboardShell();
  const clinicName = clinic?.name?.trim() || "Consultorio DrFlow";

  const result = await createCheckoutPreference({
    clinicId: access.clinicId,
    clinicName,
    planId,
    cycle,
    payerEmail: profile?.email,
    amountArs,
  });

  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  return { ok: true, initPoint: result.initPoint };
}

export async function getMercadoPagoBillingStatus() {
  return { configured: isMercadoPagoConfigured() };
}

export type CancelClinicSubscriptionActionResult =
  | { ok: true; alreadyCanceled: boolean; accessUntil: string | null }
  | { ok: false; error: string };

/** Self-serve cancel — settings ACL only; no retention obstacle. */
export async function cancelClinicSubscriptionAction(): Promise<CancelClinicSubscriptionActionResult> {
  const access = await requireClinicPermission("manageSettings");
  if (!access.ok) {
    return { ok: false, error: access.error ?? "Sin permisos para cancelar el plan." };
  }

  const result = await cancelClinicSubscriptionSelfServe({
    clinicId: access.clinicId,
    actorUserId: access.userId,
  });

  if (result.ok) {
    revalidatePath("/configuracion");
  }

  return result;
}
