import "server-only";

import {
  fetchMercadoPagoPayment,
  type MercadoPagoPayment,
  parseExternalReference,
  paymentAmountToCents,
  subscriptionPeriodEndFromCycle,
} from "@/core/billing/mercadopago";
import {
  type BillingCycle,
  billingCycleLabel,
  type BillingPlanId,
  formatPlanPriceArs,
  getBillingPlan,
} from "@/core/billing/plans";
import { logServerError } from "@/core/errors/log-error.server";
import { buildAuditLogRow } from "@/core/security/audit-log";
import { createAdminClient, hasAdminClient } from "@/core/supabase/admin";
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
    .select("*")
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
  const subscriptionActive =
    sub != null &&
    (sub.status === "active" || sub.status === "manual") &&
    (sub.current_period_end == null || new Date(sub.current_period_end).getTime() > Date.now());

  const accessActive = !trialExpired || subscriptionActive || trialEndsAt == null;

  const plan = sub ? getBillingPlan(sub.plan_id) : null;

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
    mercadoPagoConfigured: Boolean(process.env.MP_ACCESS_TOKEN?.trim()),
  };
}

export async function processApprovedMercadoPagoPayment(
  payment: MercadoPagoPayment
): Promise<ProcessPaymentResult> {
  if (!hasAdminClient()) {
    return { ok: false, error: "Service role no configurado." };
  }

  const paymentId = String(payment.id);
  if (payment.status !== "approved") {
    return { ok: false, error: `Pago ${paymentId} no aprobado (${payment.status}).` };
  }

  const ref = parseExternalReference(payment.external_reference);
  if (!ref) {
    return { ok: false, error: "external_reference inválida." };
  }

  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("clinic_subscription_payments")
    .select("id")
    .eq("mercado_pago_payment_id", paymentId)
    .maybeSingle();

  if (existing) {
    return { ok: true, alreadyProcessed: true, clinicId: ref.clinicId };
  }

  const amountCents = paymentAmountToCents(payment.transaction_amount);
  if (amountCents == null) {
    return { ok: false, error: "Monto de pago inválido." };
  }

  const periodEnd = subscriptionPeriodEndFromCycle(ref.cycle);
  const payerEmail = payment.payer?.email?.trim() ?? null;
  const now = new Date().toISOString();

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
    raw: payment as unknown as Record<string, unknown>,
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
    },
  });
  await admin.from("audit_logs").insert({ ...auditRow, user_id: null });

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

export async function processMercadoPagoPaymentId(paymentId: string): Promise<ProcessPaymentResult> {
  const payment = await fetchMercadoPagoPayment(paymentId);
  if (!payment) {
    return { ok: false, error: "No se pudo obtener el pago en Mercado Pago." };
  }
  return processApprovedMercadoPagoPayment(payment);
}
