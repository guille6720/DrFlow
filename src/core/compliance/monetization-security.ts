/**
 * Phase 19 — Monetization security posture (plans, MP webhooks, entitlements).
 * Client-side payment state must never grant a paid plan.
 * Not legal advice.
 */

import {
  isCommercialSkuId,
  resolveEffectivePrice,
} from "@/core/billing/commercial-pricing";
import {
  type BillingCycle,
  type BillingPlanId,
  getBillingPlan,
  getPlanPriceArs,
  isPlanAvailableForPurchase,
} from "@/core/billing/plans";

export type MonetizationPaymentRef = {
  clinicId: string;
  planId: BillingPlanId;
  cycle: BillingCycle;
};

export type MonetizationPaymentSnapshot = {
  status: string;
  transaction_amount?: number;
  currency_id?: string;
};

function paymentAmountToCents(amount: number | undefined): number | null {
  if (amount == null || !Number.isFinite(amount) || amount <= 0) return null;
  return Math.round(amount * 100);
}

export type MonetizationControl = {
  id: string;
  label: string;
  signals: string[];
};

export const MONETIZATION_SECURITY_CONTROLS: MonetizationControl[] = [
  {
    id: "webhook_authenticity",
    label: "Webhook Mercado Pago con HMAC + secret obligatorio en producción",
    signals: [
      "verifyMercadoPagoWebhookSignature",
      "MP_WEBHOOK_SECRET",
      "timingSafeEqual",
    ],
  },
  {
    id: "idempotency",
    label: "Idempotencia por mercado_pago_payment_id UNIQUE",
    signals: ["mercado_pago_payment_id", "alreadyProcessed", "UNIQUE"],
  },
  {
    id: "server_catalog_price",
    label: "Monto del pago debe coincidir con precio efectivo (snapshot o catálogo)",
    signals: ["assertApprovedPaymentMatchesCatalog", "resolveEffectivePrice", "resolveCheckoutAmountArs"],
  },
  {
    id: "no_client_plan_forge",
    label: "Plan/entitlements no forgeables desde el cliente",
    signals: [
      "assign_clinic_entitlement_plan",
      "assert_entitlement_superadmin",
      "clinic_subscriptions_select",
      "requireSettingsAccess",
    ],
  },
  {
    id: "checkout_session_bound",
    label: "Checkout preference usa clinicId de sesión, no del body",
    signals: ["access.clinicId", "createCheckoutPreference", "buildExternalReference"],
  },
  {
    id: "payment_source_of_truth",
    label: "Estado de pago se lee de API MP (no del body del webhook)",
    signals: ["fetchMercadoPagoPayment", "processApprovedMercadoPagoPayment"],
  },
];

export type MonetizationLifecycleCapability = {
  id: string;
  label: string;
  status: "implemented" | "partial" | "external";
  notes: string;
};

export const MONETIZATION_LIFECYCLE: MonetizationLifecycleCapability[] = [
  {
    id: "plans_catalog",
    label: "Catálogo de planes y precios",
    status: "implemented",
    notes: "Essential/Pro + resolveEffectivePrice (promo 6 meses). SKUs históricos parseables.",
  },
  {
    id: "checkout",
    label: "Checkout Mercado Pago",
    status: "implemented",
    notes: "Preference server-side con CSRF + settings ACL + monto efectivo.",
  },
  {
    id: "webhook_activate",
    label: "Activación por webhook aprobado",
    status: "implemented",
    notes: "HMAC, idempotencia, monto vs snapshot/catálogo, assign entitlement via service_role.",
  },
  {
    id: "failed_payments",
    label: "Pagos fallidos / pending",
    status: "partial",
    notes: "Webhook ignora no-approved; no activa plan. past_due vía superadmin/comercial.",
  },
  {
    id: "cancellation",
    label: "Cancelación de suscripción",
    status: "implemented",
    notes:
      "Self-serve en Configuración (Fase 21); acceso hasta fin de período. Preapproval MP parcial. B2B/B2C: REQUIERE REVISIÓN LEGAL SEGÚN TIPO DE CLIENTE B2B/B2C.",
  },
  {
    id: "refunds",
    label: "Reembolsos / chargebacks",
    status: "partial",
    notes: "Webhook puede marcar past_due si llega refunded/charged_back sobre pago conocido.",
  },
  {
    id: "plan_changes",
    label: "Cambio de plan",
    status: "partial",
    notes:
      "Upgrade Essential→Pro conserva promo_ends_at. Downgrade bloqueado si >1 profesional. WARNING: Checkout Pro one-shot — la transición de precio aplica al próximo checkout, no a un cargo MP automático.",
  },
  {
    id: "arca_invoicing",
    label: "Facturación fiscal ARCA",
    status: "external",
    notes:
      "Comprobante MP ≠ factura fiscal. Ver tax-invoicing-argentina.ts + FACTURACION-ARGENTINA.md (REQUIERE CONTADOR).",
  },
];

export type ExpectedAmountContext = {
  /** Whole ARS already resolved (preferred). */
  expectedArs?: number | null;
  promoEndsAt?: string | Date | null;
  promoPriceArs?: number | null;
  regularPriceArs?: number | null;
  at?: Date;
};

/**
 * Validate approved payment amount against effective expected price.
 * Prefer `expectedArs` from resolveCheckoutAmountArs; otherwise commercial promo catalog
 * or historic fixed price.
 */
export function assertApprovedPaymentMatchesCatalog(
  payment: MonetizationPaymentSnapshot,
  ref: MonetizationPaymentRef,
  context?: ExpectedAmountContext
): { ok: true; expectedArs: number; paidCents: number } | { ok: false; error: string } {
  if (payment.status !== "approved") {
    return { ok: false, error: "Pago no aprobado." };
  }

  const plan = getBillingPlan(ref.planId);
  if (!plan) {
    return { ok: false, error: "Plan desconocido." };
  }

  let expectedArs = context?.expectedArs ?? null;

  if (expectedArs == null && isCommercialSkuId(ref.planId)) {
    if (ref.cycle === "annual") {
      return { ok: false, error: "Ciclo anual no disponible para planes comerciales actuales." };
    }
    if (!isPlanAvailableForPurchase(plan) && context?.expectedArs == null) {
      // Still allow if we have snapshot context for renewals
    }
    const effective = resolveEffectivePrice({
      planId: ref.planId,
      promoStartedAt: null,
      promoEndsAt: context?.promoEndsAt ?? null,
      promoPriceArs: context?.promoPriceArs ?? null,
      regularPriceArs: context?.regularPriceArs ?? null,
      at: context?.at,
    });
    expectedArs = effective?.amountArs ?? null;
  }

  if (expectedArs == null) {
    expectedArs = getPlanPriceArs(ref.planId, ref.cycle);
  }

  if (expectedArs == null) {
    return { ok: false, error: "Precio efectivo ausente." };
  }

  // New commercial purchases must be purchasable unless validating historic SKU
  if (isCommercialSkuId(ref.planId) && !isPlanAvailableForPurchase(plan)) {
    return { ok: false, error: "Plan no disponible en catálogo." };
  }

  const paidCents = paymentAmountToCents(payment.transaction_amount);
  if (paidCents == null) {
    return { ok: false, error: "Monto de pago inválido." };
  }

  const expectedCents = Math.round(expectedArs * 100);
  if (paidCents !== expectedCents) {
    return {
      ok: false,
      error: `Monto no coincide con precio efectivo (esperado ${expectedCents} centavos).`,
    };
  }

  const currency = payment.currency_id?.trim().toUpperCase();
  if (currency && currency !== "ARS") {
    return { ok: false, error: "Moneda no soportada (solo ARS)." };
  }

  return { ok: true, expectedArs, paidCents };
}

/** Payment statuses that must never activate a paid plan. */
export const NON_ACTIVATING_PAYMENT_STATUSES = [
  "pending",
  "in_process",
  "rejected",
  "cancelled",
  "refunded",
  "charged_back",
] as const;

export function isActivatingPaymentStatus(status: string): boolean {
  return status === "approved";
}

export function isRefundOrChargebackStatus(status: string): boolean {
  return status === "refunded" || status === "charged_back";
}

export type MonetizationSecurityPosture = {
  clientCannotForgePaidPlan: true;
  webhookRequiresSecretInProduction: true;
  amountMustMatchCatalog: true;
  controlCount: number;
  notes: string[];
};

export function evaluateMonetizationSecurityPosture(): MonetizationSecurityPosture {
  return {
    clientCannotForgePaidPlan: true,
    webhookRequiresSecretInProduction: true,
    amountMustMatchCatalog: true,
    controlCount: MONETIZATION_SECURITY_CONTROLS.length,
    notes: [
      "clinic_subscriptions solo SELECT vía RLS — mutación por service_role/webhook.",
      "assign_clinic_entitlement_plan exige superadmin o service_role.",
      "Checkout usa clinicId de sesión autenticada, no del cliente.",
      "Monto validado contra snapshot promo o catálogo server-side.",
      "external_reference se parsea del pago MP (fuente de verdad API), no del body crudo solo.",
    ],
  };
}

export type { BillingCycle, BillingPlanId };
