import "server-only";

import {
  loadSubscriptionPromoSnapshot,
  resolveCheckoutAmountArs,
} from "@/core/billing/checkout-amount";
import {
  buildNewSubscriptionPromoSnapshot,
  buildUpgradeProPromoFields,
  isCommercialSkuId,
  resolveEffectivePrice,
} from "@/core/billing/commercial-pricing";
import {
  fetchMercadoPagoPayment,
  isMercadoPagoConfigured,
  type MercadoPagoPayment,
  parseExternalReference,
  subscriptionPeriodEndFromCycle,
} from "@/core/billing/mercadopago";
import {
  classifyPlanChange,
  shouldPreservePromoWindowOnUpgrade,
} from "@/core/billing/plan-change";
import {
  type BillingCycle,
  billingCycleLabel,
  type BillingPlanId,
  formatPlanPriceArs,
  getBillingPlan,
} from "@/core/billing/plans";
import {
  evaluateCancellationEligibility,
  subscriptionGrantsAccess,
} from "@/core/compliance/cancellation-consumer-rights";
import {
  assertApprovedPaymentMatchesCatalog,
  isActivatingPaymentStatus,
  isRefundOrChargebackStatus,
} from "@/core/compliance/monetization-security";
import { buildSaasFiscalInvoiceAuditMetadata } from "@/core/compliance/tax-invoicing-argentina";
import { commercialPlanKeyFromBillingPlan } from "@/core/entitlements/billing-plan-map";
import { logServerError } from "@/core/errors/log-error.server";
import { buildAuditLogRow } from "@/core/security/audit-log";
import { createAdminClient, hasAdminClient } from "@/core/supabase/admin";
import { toJson } from "@/core/supabase/json";
import { CLINIC_SUBSCRIPTION_COLUMNS } from "@/core/supabase/select-columns";
import { createClient } from "@/core/supabase/server";
import { isClinicTrialExpired, trialDaysRemaining } from "@/core/trial/clinic-trial";

import {
  buildSubscriptionReceiptEmailContent,
  sendSubscriptionReceiptEmail,
} from "@/lib/services/subscription-receipt-email";

export type ClinicSubscriptionRow = {
  id: string;
  clinic_id: string;
  plan_id: BillingPlanId;
  status: "trialing" | "active" | "past_due" | "canceled" | "manual";
  billing_cycle: BillingCycle;
  mercado_pago_payer_email: string | null;
  current_period_end: string | null;
  canceled_at: string | null;
  promo_started_at?: string | null;
  promo_ends_at?: string | null;
  promo_months?: number | null;
  promo_price_amount?: number | null;
  regular_price_amount?: number | null;
  price_currency?: string | null;
  created_at: string;
  updated_at: string;
};

export type ClinicSubscriptionSummary = {
  clinicId: string;
  clinicName: string;
  trialEndsAt: string | null;
  trialDaysRemaining: number | null;
  trialExpired: boolean;
  subscription: ClinicSubscriptionRow | null;
  accessActive: boolean;
  planLabel: string | null;
  cycleLabel: string | null;
  periodEndLabel: string | null;
  lastPaymentAt: string | null;
  mercadoPagoConfigured: boolean;
  /** Current effective monthly price (ARS) if commercial. */
  effectivePriceArs: number | null;
  pricePhase: "promotional" | "regular" | null;
  promoEndsLabel: string | null;
  nextChargeArs: number | null;
};

export type ProcessPaymentResult =
  | { ok: true; alreadyProcessed: boolean; clinicId: string }
  | { ok: false; error: string };

function formatPeriodEnd(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export async function loadClinicSubscriptionSummary(
  clinicId: string,
  clinicName: string,
  trialEndsAt: string | null
): Promise<ClinicSubscriptionSummary> {
  const supabase = await createClient();
  const { data: subscription } = await supabase
    .from("clinic_subscriptions")
    .select(CLINIC_SUBSCRIPTION_COLUMNS)
    .eq("clinic_id", clinicId)
    .maybeSingle();

  const { data: lastPayment } = await supabase
    .from("clinic_subscription_payments")
    .select("created_at")
    .eq("clinic_id", clinicId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const sub = subscription as ClinicSubscriptionRow | null;
  const trialExpired = isClinicTrialExpired({ trial_ends_at: trialEndsAt });
  const daysLeft = trialDaysRemaining(trialEndsAt);
  const subscriptionActive = subscriptionGrantsAccess({
    status: sub?.status,
    currentPeriodEnd: sub?.current_period_end,
  });

  const accessActive = !trialExpired || subscriptionActive || trialEndsAt == null;

  const plan = sub ? getBillingPlan(sub.plan_id) : null;

  let effectivePriceArs: number | null = null;
  let pricePhase: "promotional" | "regular" | null = null;
  let promoEndsLabel: string | null = null;
  let nextChargeArs: number | null = null;

  if (sub && isCommercialSkuId(sub.plan_id)) {
    const effective = resolveEffectivePrice({
      planId: sub.plan_id,
      promoStartedAt: sub.promo_started_at,
      promoEndsAt: sub.promo_ends_at,
      promoPriceArs: sub.promo_price_amount,
      regularPriceArs: sub.regular_price_amount,
    });
    if (effective) {
      effectivePriceArs = effective.amountArs;
      pricePhase = effective.phase;
      promoEndsLabel = formatPeriodEnd(effective.promoEndsAt);
      nextChargeArs = effective.amountArs;
    }
  }

  return {
    clinicId,
    clinicName,
    trialEndsAt,
    trialDaysRemaining: daysLeft,
    trialExpired,
    subscription: sub,
    accessActive,
    planLabel: plan?.name ?? null,
    cycleLabel: sub ? billingCycleLabel(sub.billing_cycle) : null,
    periodEndLabel: formatPeriodEnd(sub?.current_period_end ?? null),
    lastPaymentAt: lastPayment?.created_at ?? null,
    mercadoPagoConfigured: isMercadoPagoConfigured(),
    effectivePriceArs,
    pricePhase,
    promoEndsLabel,
    nextChargeArs,
  };
}

export type CancelSubscriptionResult =
  | { ok: true; alreadyCanceled: boolean; accessUntil: string | null }
  | { ok: false; error: string };

/**
 * Self-serve cancel: marks subscription canceled; access continues until current_period_end.
 * Uses service role (RLS is SELECT-only on clinic_subscriptions).
 */
export async function cancelClinicSubscriptionSelfServe(input: {
  clinicId: string;
  actorUserId: string;
}): Promise<CancelSubscriptionResult> {
  if (!hasAdminClient()) {
    return { ok: false, error: "Service role no configurado." };
  }

  const admin = createAdminClient();
  const { data: sub, error: loadError } = await admin
    .from("clinic_subscriptions")
    .select("id, status, current_period_end, canceled_at")
    .eq("clinic_id", input.clinicId)
    .maybeSingle();

  if (loadError) {
    logServerError("billing.subscription.cancel.load", loadError);
    return { ok: false, error: loadError.message };
  }

  if (!sub) {
    return { ok: false, error: "No hay suscripción para cancelar." };
  }

  if (sub.status === "canceled") {
    return {
      ok: true,
      alreadyCanceled: true,
      accessUntil: sub.current_period_end,
    };
  }

  const eligibility = evaluateCancellationEligibility({ status: sub.status });
  if (!eligibility.ok) {
    return { ok: false, error: eligibility.error };
  }

  const now = new Date().toISOString();
  const { error: updateError } = await admin
    .from("clinic_subscriptions")
    .update({
      status: "canceled",
      canceled_at: now,
      updated_at: now,
    })
    .eq("id", sub.id)
    .eq("clinic_id", input.clinicId);

  if (updateError) {
    logServerError("billing.subscription.cancel", updateError);
    return { ok: false, error: updateError.message };
  }

  const auditRow = buildAuditLogRow({
    clinicId: input.clinicId,
    module: "system",
    what: "Suscripción cancelada (self-serve, acceso hasta fin de período)",
    entityType: "clinic_subscription",
    entityId: sub.id,
    action: "update",
    userId: input.actorUserId,
    metadata: {
      source: "self_serve_cancel",
      mode: eligibility.mode,
      accessUntil: sub.current_period_end,
      previousStatus: sub.status,
    },
  });
  await admin.from("audit_logs").insert(auditRow);

  return {
    ok: true,
    alreadyCanceled: false,
    accessUntil: sub.current_period_end,
  };
}

export async function processApprovedMercadoPagoPayment(
  payment: MercadoPagoPayment
): Promise<ProcessPaymentResult> {
  if (!hasAdminClient()) {
    return { ok: false, error: "Service role no configurado." };
  }

  const paymentId = String(payment.id);
  if (!isActivatingPaymentStatus(payment.status)) {
    return { ok: false, error: `Pago ${paymentId} no aprobado (${payment.status}).` };
  }

  const ref = parseExternalReference(payment.external_reference);
  if (!ref) {
    return { ok: false, error: "external_reference inválida." };
  }

  const existingSnap = await loadSubscriptionPromoSnapshot(ref.clinicId, true);
  const expectedArs = resolveCheckoutAmountArs({
    planId: ref.planId,
    cycle: ref.cycle,
    snapshot: existingSnap,
  });

  const amountCheck = assertApprovedPaymentMatchesCatalog(payment, ref, {
    expectedArs,
    promoEndsAt: existingSnap?.promo_ends_at,
    promoPriceArs: existingSnap?.promo_price_amount,
    regularPriceArs: existingSnap?.regular_price_amount,
  });
  if (!amountCheck.ok) {
    logServerError(
      "billing.payment.amount_mismatch",
      new Error(amountCheck.error),
      { persist: false }
    );
    return { ok: false, error: amountCheck.error };
  }

  const admin = createAdminClient();

  const { data: clinicRow } = await admin
    .from("clinics")
    .select("id")
    .eq("id", ref.clinicId)
    .maybeSingle();
  if (!clinicRow) {
    return { ok: false, error: "Consultorio de external_reference no encontrado." };
  }

  const { data: existing } = await admin
    .from("clinic_subscription_payments")
    .select("id")
    .eq("mercado_pago_payment_id", paymentId)
    .maybeSingle();

  if (existing) {
    return { ok: true, alreadyProcessed: true, clinicId: ref.clinicId };
  }

  const amountCents = amountCheck.paidCents;
  const periodEnd = subscriptionPeriodEndFromCycle(ref.cycle);
  const payerEmail = payment.payer?.email?.trim() ?? null;
  const now = new Date().toISOString();
  const activatedAt = new Date();

  const changeKind = classifyPlanChange(existingSnap?.plan_id, ref.planId);
  let promoFields: Record<string, unknown> = {};

  if (isCommercialSkuId(ref.planId)) {
    if (shouldPreservePromoWindowOnUpgrade(changeKind) && existingSnap?.promo_ends_at) {
      promoFields = buildUpgradeProPromoFields({
        promo_started_at: existingSnap.promo_started_at,
        promo_ends_at: existingSnap.promo_ends_at,
        promo_months: existingSnap.promo_months,
      });
    } else if (
      existingSnap &&
      existingSnap.plan_id === ref.planId &&
      existingSnap.promo_ends_at
    ) {
      // Renewal / same plan: keep original promo window and snapshotted amounts
      promoFields = {
        promo_started_at: existingSnap.promo_started_at,
        promo_ends_at: existingSnap.promo_ends_at,
        promo_months: existingSnap.promo_months,
        promo_price_amount: existingSnap.promo_price_amount,
        regular_price_amount: existingSnap.regular_price_amount,
        price_currency: "ARS",
      };
    } else {
      promoFields = buildNewSubscriptionPromoSnapshot(ref.planId, activatedAt);
    }
  }

  const { data: subscription, error: subError } = await admin
    .from("clinic_subscriptions")
    .upsert(
      {
        clinic_id: ref.clinicId,
        plan_id: ref.planId,
        status: "active",
        billing_cycle: ref.cycle,
        mercado_pago_payer_email: payerEmail,
        current_period_end: periodEnd,
        canceled_at: null,
        updated_at: now,
        ...promoFields,
      },
      { onConflict: "clinic_id" }
    )
    .select("id")
    .single();

  if (subError || !subscription) {
    logServerError("billing.subscription.upsert", subError);
    return { ok: false, error: subError?.message ?? "No se pudo actualizar la suscripción." };
  }

  const { error: payError } = await admin.from("clinic_subscription_payments").insert({
    clinic_id: ref.clinicId,
    subscription_id: subscription.id,
    mercado_pago_payment_id: paymentId,
    amount_cents: amountCents,
    currency: payment.currency_id ?? "ARS",
    status: payment.status,
    plan_id: ref.planId,
    billing_cycle: ref.cycle,
    raw: toJson(payment),
  });

  if (payError) {
    logServerError("billing.payment.insert", payError);
    return { ok: false, error: payError.message };
  }

  await admin
    .from("clinics")
    .update({ trial_ends_at: null, updated_at: now })
    .eq("id", ref.clinicId);

  const plan = getBillingPlan(ref.planId);
  const amountLabel = formatPlanPriceArs(payment.transaction_amount ?? amountCents / 100);

  const fiscalAudit = await buildSaasFiscalInvoiceAuditMetadata({
    clinicId: ref.clinicId,
    mercadoPagoPaymentId: paymentId,
    amountCents,
    planId: ref.planId,
    billingCycle: ref.cycle,
    buyerEmail: payerEmail,
  });

  const auditRow = buildAuditLogRow({
    clinicId: ref.clinicId,
    module: "system",
    what: "Suscripción activada vía Mercado Pago",
    entityType: "clinic_subscription",
    entityId: subscription.id,
    action: "update",
    userId: "00000000-0000-0000-0000-000000000000",
    metadata: {
      source: "mercadopago_webhook",
      paymentId,
      planId: ref.planId,
      cycle: ref.cycle,
      amount: payment.transaction_amount,
      fiscal: fiscalAudit,
    },
  });
  await admin.from("audit_logs").insert({ ...auditRow, user_id: null });

  const { error: entitlementError } = await admin.rpc("assign_clinic_entitlement_plan", {
    p_clinic_id: ref.clinicId,
    p_plan_key: commercialPlanKeyFromBillingPlan(ref.planId),
    p_reason: "mercadopago_payment",
  });
  if (entitlementError) {
    logServerError("billing.entitlement.assign", entitlementError, { persist: false });
  }

  if (payerEmail) {
    const { data: clinic } = await admin
      .from("clinics")
      .select("name")
      .eq("id", ref.clinicId)
      .maybeSingle();

    const emailContent = buildSubscriptionReceiptEmailContent({
      clinicName: clinic?.name ?? "tu consultorio",
      planName: plan?.name ?? ref.planId,
      cycleLabel: billingCycleLabel(ref.cycle),
      amountLabel,
      periodEndLabel: formatPeriodEnd(periodEnd) ?? periodEnd,
    });

    await sendSubscriptionReceiptEmail({
      to: payerEmail,
      ...emailContent,
    }).catch((err) => logServerError("billing.receipt-email", err));
  }

  return { ok: true, alreadyProcessed: false, clinicId: ref.clinicId };
}

/**
 * Refund / chargeback: only demotes if we already recorded the payment (no privilege grant).
 * Does not invent clinicId from client — uses stored payment + MP external_reference.
 */
export async function processRefundOrChargebackMercadoPagoPayment(
  payment: MercadoPagoPayment
): Promise<ProcessPaymentResult> {
  if (!hasAdminClient()) {
    return { ok: false, error: "Service role no configurado." };
  }

  const paymentId = String(payment.id);
  if (!isRefundOrChargebackStatus(payment.status)) {
    return { ok: false, error: `Pago ${paymentId} no es refund/chargeback (${payment.status}).` };
  }

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("clinic_subscription_payments")
    .select("id, clinic_id, subscription_id, status")
    .eq("mercado_pago_payment_id", paymentId)
    .maybeSingle();

  if (!existing) {
    const ref = parseExternalReference(payment.external_reference);
    return {
      ok: true,
      alreadyProcessed: true,
      clinicId: ref?.clinicId ?? "00000000-0000-0000-0000-000000000000",
    };
  }

  if (existing.status === payment.status) {
    return { ok: true, alreadyProcessed: true, clinicId: existing.clinic_id };
  }

  const now = new Date().toISOString();
  await admin
    .from("clinic_subscription_payments")
    .update({ status: payment.status, raw: toJson(payment) })
    .eq("id", existing.id);

  await admin
    .from("clinic_subscriptions")
    .update({ status: "past_due", updated_at: now })
    .eq("clinic_id", existing.clinic_id)
    .in("status", ["active", "trialing"]);

  const auditRow = buildAuditLogRow({
    clinicId: existing.clinic_id,
    module: "system",
    what: `Suscripción marcada past_due por ${payment.status} Mercado Pago`,
    entityType: "clinic_subscription",
    entityId: existing.subscription_id ?? existing.id,
    action: "update",
    userId: "00000000-0000-0000-0000-000000000000",
    metadata: {
      source: "mercadopago_webhook",
      paymentId,
      status: payment.status,
    },
  });
  await admin.from("audit_logs").insert({ ...auditRow, user_id: null });

  return { ok: true, alreadyProcessed: false, clinicId: existing.clinic_id };
}

export async function processMercadoPagoPaymentId(paymentId: string): Promise<ProcessPaymentResult> {
  const payment = await fetchMercadoPagoPayment(paymentId);
  if (!payment) {
    return { ok: false, error: "No se pudo obtener el pago en Mercado Pago." };
  }
  if (isActivatingPaymentStatus(payment.status)) {
    return processApprovedMercadoPagoPayment(payment);
  }
  if (isRefundOrChargebackStatus(payment.status)) {
    return processRefundOrChargebackMercadoPagoPayment(payment);
  }
  return { ok: false, error: `Pago ${paymentId} no procesable (${payment.status}).` };
}
