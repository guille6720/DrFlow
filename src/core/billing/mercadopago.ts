import "server-only";

import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

import {
  type BillingCycle,
  type BillingPlanId,
  getPlanMercadoPagoSku,
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

export function isMercadoPagoTestToken(token?: string | null): boolean {
  const value = token ?? getMercadoPagoAccessToken();
  return Boolean(value?.startsWith("TEST-"));
}

/**
 * Turn raw Mercado Pago API errors into actionable Spanish copy (no token leakage).
 */
export function formatMercadoPagoApiError(raw: string, httpStatus?: number): string {
  let code: string | undefined;
  let message: string | undefined;
  try {
    const parsed = JSON.parse(raw) as { code?: string; message?: string };
    code = parsed.code;
    message = parsed.message;
  } catch {
    // keep raw fallback below
  }

  const normalized = (code ?? message ?? raw).toUpperCase();

  if (
    normalized.includes("FA_UNAUTHORIZED") ||
    normalized.includes("PA_UNAUTHORIZED") ||
    normalized.includes("UNAUTHORIZED_RESULT_FROM_POLICIES") ||
    httpStatus === 401 ||
    httpStatus === 403
  ) {
    return (
      "Mercado Pago rechazó la preferencia de pago (credenciales no autorizadas). " +
      "Revisá en Vercel que MP_ACCESS_TOKEN o MERCADOPAGO_ACCESS_TOKEN sea el Access Token " +
      "de producción o prueba (TEST-…) de tu app en developers.mercadopago.com — no la Public Key. " +
      "Si la cuenta está bloqueada, contactá soporte de Mercado Pago."
    );
  }

  if (normalized.includes("INVALID_AUTO_RETURN")) {
    return "Mercado Pago no pudo validar la URL de retorno. Revisá NEXT_PUBLIC_SITE_URL o el dominio del deploy.";
  }

  if (message?.trim()) return message.trim();
  if (raw.trim()) return raw.trim();
  return `Mercado Pago respondió HTTP ${httpStatus ?? "error"}.`;
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
  const allowedPlans: BillingPlanId[] = [
    "essential",
    "pro",
    "solo",
    "consultorio",
    "clinica",
  ];
  if (!allowedPlans.includes(planId as BillingPlanId)) return null;
  if (cycle !== "monthly" && cycle !== "annual") return null;
  return { clinicId, planId: planId as BillingPlanId, cycle };
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
  /** Whole ARS from resolveCheckoutAmountArs (server). Required for promo snapshot. */
  amountArs: number;
  /** Prefer request host on Vercel previews so back_urls match the active deploy. */
  siteUrlOverride?: string | null;
}): Promise<CreatePreferenceResult> {
  const accessToken = getMercadoPagoAccessToken();
  if (!accessToken) {
    return {
      ok: false,
      error: "Mercado Pago no está configurado (MP_ACCESS_TOKEN / MERCADOPAGO_ACCESS_TOKEN).",
    };
  }

  const amount = input.amountArs;
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: "Plan no disponible para compra." };
  }

  const siteUrl = getPublicSiteUrl(input.siteUrlOverride ?? undefined);
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
    statement_descriptor: "DRFLOW",
  };

  if (input.payerEmail?.trim()) {
    body.payer = { email: input.payerEmail.trim() };
  }

  const idempotencyKey = randomUUID();
  const response = await fetch(`${MP_API_BASE}/checkout/preferences`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    return {
      ok: false,
      error: formatMercadoPagoApiError(text, response.status),
    };
  }

  const data = (await response.json()) as {
    id?: string;
    init_point?: string;
    sandbox_init_point?: string;
  };

  const useSandbox = isMercadoPagoTestToken(accessToken);
  const initPoint = useSandbox
    ? (data.sandbox_init_point ?? data.init_point)
    : (data.init_point ?? data.sandbox_init_point);
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
