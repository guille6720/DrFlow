import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import {
  type BillingCycle,
  type BillingPlanId,
  getPlanMercadoPagoSku,
  getPlanPriceArs,
} from "@/core/billing/plans";
import { getPublicSiteUrl } from "@/core/supabase/env";

const MP_API_BASE = "https://api.mercadopago.com";

/** Accept both MP_* (code convention) and MERCADOPAGO_* (Vercel naming). */
export function getMercadoPagoAccessToken(): string | null {
  const token =
    process.env.MP_ACCESS_TOKEN?.trim() ||
    process.env.MERCADOPAGO_ACCESS_TOKEN?.trim() ||
    "";
  return token || null;
}

export function getMercadoPagoWebhookSecret(): string | null {
  const secret =
    process.env.MP_WEBHOOK_SECRET?.trim() ||
    process.env.MERCADOPAGO_WEBHOOK_SECRET?.trim() ||
    "";
  return secret || null;
}

export type MercadoPagoExternalReference = {
  clinicId: string;
  planId: BillingPlanId;
  cycle: BillingCycle;
};

export type MercadoPagoPayment = {
  id: number | string;
  status: string;
  status_detail?: string;
  external_reference?: string | null;
  transaction_amount?: number;
  currency_id?: string;
  payer?: { email?: string | null };
};

export type CreatePreferenceResult =
  | { ok: true; preferenceId: string; initPoint: string }
  | { ok: false; error: string };

export function isMercadoPagoConfigured(): boolean {
  return Boolean(getMercadoPagoAccessToken());
}

export function buildExternalReference(input: MercadoPagoExternalReference): string {
  return `${input.clinicId}:${input.planId}:${input.cycle}`;
}

export function parseExternalReference(
  value: string | null | undefined
): MercadoPagoExternalReference | null {
  if (!value?.trim()) return null;
  const parts = value.trim().split(":");
  if (parts.length !== 3) return null;
  const [clinicId, planId, cycle] = parts;
  if (!clinicId || !planId) return null;
  if (planId !== "solo" && planId !== "consultorio" && planId !== "clinica") return null;
  if (cycle !== "monthly" && cycle !== "annual") return null;
  return { clinicId, planId, cycle };
}

export function verifyMercadoPagoWebhookSignature(input: {
  signatureHeader: string | null;
  requestId: string | null;
  dataId: string;
  secret?: string | null;
}): boolean {
  const secret = input.secret?.trim() ?? getMercadoPagoWebhookSecret() ?? "";
  if (!secret || !input.signatureHeader) return false;

  const parts = Object.fromEntries(
    input.signatureHeader.split(",").map((segment) => {
      const [key, ...rest] = segment.trim().split("=");
      return [key, rest.join("=")];
    })
  ) as Record<string, string>;

  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1) return false;

  const manifest = `id:${input.dataId};request-id:${input.requestId ?? ""};ts:${ts};`;
  const expected = createHmac("sha256", secret).update(manifest).digest("hex");

  try {
    const a = Buffer.from(v1, "hex");
    const b = Buffer.from(expected, "hex");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function createCheckoutPreference(input: {
  clinicId: string;
  clinicName: string;
  planId: BillingPlanId;
  cycle: BillingCycle;
  payerEmail?: string | null;
}): Promise<CreatePreferenceResult> {
  const accessToken = getMercadoPagoAccessToken();
  if (!accessToken) {
    return {
      ok: false,
      error: "Mercado Pago no está configurado (MP_ACCESS_TOKEN / MERCADOPAGO_ACCESS_TOKEN).",
    };
  }

  const amount = getPlanPriceArs(input.planId, input.cycle);
  if (amount == null) {
    return { ok: false, error: "Plan no disponible para compra." };
  }

  const siteUrl = getPublicSiteUrl();
  const externalReference = buildExternalReference({
    clinicId: input.clinicId,
    planId: input.planId,
    cycle: input.cycle,
  });
  const sku = getPlanMercadoPagoSku(input.planId, input.cycle);
  const cycleLabel = input.cycle === "annual" ? "anual" : "mensual";

  const body: Record<string, unknown> = {
    items: [
      {
        id: sku,
        title: `DrFlow — plan ${input.planId} (${cycleLabel})`,
        description: `Suscripción DrFlow para ${input.clinicName}`,
        quantity: 1,
        currency_id: "ARS",
        unit_price: amount,
      },
    ],
    external_reference: externalReference,
    notification_url: `${siteUrl}/api/billing/webhooks/mercadopago`,
    back_urls: {
      success: `${siteUrl}/configuracion?grupo=consultorio&seccion=plan&pago=ok`,
      failure: `${siteUrl}/configuracion?grupo=consultorio&seccion=plan&pago=error`,
      pending: `${siteUrl}/configuracion?grupo=consultorio&seccion=plan&pago=pending`,
    },
    auto_return: "approved",
    statement_descriptor: "DRFLOW",
  };

  if (input.payerEmail?.trim()) {
    body.payer = { email: input.payerEmail.trim() };
  }

  const response = await fetch(`${MP_API_BASE}/checkout/preferences`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    return {
      ok: false,
      error: text || `Mercado Pago respondió HTTP ${response.status}`,
    };
  }

  const data = (await response.json()) as {
    id?: string;
    init_point?: string;
    sandbox_init_point?: string;
  };

  const initPoint = data.init_point ?? data.sandbox_init_point;
  if (!data.id || !initPoint) {
    return { ok: false, error: "Respuesta inválida de Mercado Pago." };
  }

  return { ok: true, preferenceId: data.id, initPoint };
}

export async function fetchMercadoPagoPayment(paymentId: string): Promise<MercadoPagoPayment | null> {
  const accessToken = getMercadoPagoAccessToken();
  if (!accessToken) return null;

  const response = await fetch(`${MP_API_BASE}/v1/payments/${encodeURIComponent(paymentId)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  if (!response.ok) return null;
  return (await response.json()) as MercadoPagoPayment;
}

export function paymentAmountToCents(amount: number | undefined): number | null {
  if (amount == null || !Number.isFinite(amount) || amount <= 0) return null;
  return Math.round(amount * 100);
}

export function subscriptionPeriodEndFromCycle(cycle: BillingCycle, from = new Date()): string {
  const end = new Date(from);
  if (cycle === "annual") {
    end.setFullYear(end.getFullYear() + 1);
  } else {
    end.setMonth(end.getMonth() + 1);
  }
  return end.toISOString();
}
