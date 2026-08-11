"use server";

import { requireSettingsAccess } from "@/core/actions/clinic-guard";
import { getDashboardShell } from "@/core/auth/session.server";
import { createCheckoutPreference, isMercadoPagoConfigured } from "@/core/billing/mercadopago";
import {
  type BillingCycle,
  type BillingPlanId,
  getBillingPlan,
  getPlanPriceArs,
  isPlanAvailableForPurchase,
} from "@/core/billing/plans";

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

  const price = getPlanPriceArs(planId, cycle);
  if (price == null) {
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
  });

  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  return { ok: true, initPoint: result.initPoint };
}

export async function getMercadoPagoBillingStatus() {
  return { configured: isMercadoPagoConfigured() };
}
