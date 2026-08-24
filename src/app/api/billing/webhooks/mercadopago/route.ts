import { NextResponse } from "next/server";

import {
  fetchMercadoPagoPayment,
  getMercadoPagoWebhookSecret,
  verifyMercadoPagoWebhookSignature,
} from "@/core/billing/mercadopago";
import {
  processApprovedMercadoPagoPayment,
  processRefundOrChargebackMercadoPagoPayment,
} from "@/core/billing/subscription-service";
import {
  isActivatingPaymentStatus,
  isRefundOrChargebackStatus,
} from "@/core/compliance/monetization-security";
import { logServerError } from "@/core/errors/log-error.server";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" } as const;

type WebhookBody = {
  action?: string;
  type?: string;
  data?: { id?: string | number };
};

function extractPaymentId(body: WebhookBody, url: URL): string | null {
  const fromBody = body.data?.id;
  if (fromBody != null && String(fromBody).length > 0) {
    return String(fromBody);
  }
  const fromQuery = url.searchParams.get("data.id") ?? url.searchParams.get("id");
  return fromQuery?.trim() || null;
}

async function handlePaymentNotification(paymentId: string) {
  const payment = await fetchMercadoPagoPayment(paymentId);
  if (!payment) {
    return NextResponse.json({ ok: false, error: "payment_not_found" }, { status: 404, headers: NO_STORE });
  }

  if (isActivatingPaymentStatus(payment.status)) {
    const result = await processApprovedMercadoPagoPayment(payment);
    if (!result.ok) {
      logServerError("api.billing.webhook.process", new Error(result.error));
      return NextResponse.json({ ok: false, error: result.error }, { status: 500, headers: NO_STORE });
    }
    return NextResponse.json(
      { ok: true, clinicId: result.clinicId, alreadyProcessed: result.alreadyProcessed },
      { headers: NO_STORE }
    );
  }

  if (isRefundOrChargebackStatus(payment.status)) {
    const result = await processRefundOrChargebackMercadoPagoPayment(payment);
    if (!result.ok) {
      logServerError("api.billing.webhook.refund", new Error(result.error));
      return NextResponse.json({ ok: false, error: result.error }, { status: 500, headers: NO_STORE });
    }
    return NextResponse.json(
      {
        ok: true,
        refund: true,
        clinicId: result.clinicId,
        alreadyProcessed: result.alreadyProcessed,
      },
      { headers: NO_STORE }
    );
  }

  return NextResponse.json(
    { ok: true, skipped: true, status: payment.status },
    { headers: NO_STORE }
  );
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  let body: WebhookBody = {};

  try {
    body = (await request.json()) as WebhookBody;
  } catch {
    body = {};
  }

  const paymentId = extractPaymentId(body, url);
  if (!paymentId) {
    return NextResponse.json({ ok: true, ignored: true }, { headers: NO_STORE });
  }

  const signatureOk = verifyMercadoPagoWebhookSignature({
    signatureHeader: request.headers.get("x-signature"),
    requestId: request.headers.get("x-request-id"),
    dataId: paymentId,
  });

  if (!signatureOk && getMercadoPagoWebhookSecret()) {
    return NextResponse.json({ error: "Firma inválida." }, { status: 401, headers: NO_STORE });
  }

  if (!getMercadoPagoWebhookSecret() && process.env.NODE_ENV === "production") {
    logServerError(
      "api.billing.webhook.missing_secret",
      new Error("MP_WEBHOOK_SECRET no configurado en producción")
    );
    return NextResponse.json(
      { error: "Webhook no configurado." },
      { status: 503, headers: NO_STORE }
    );
  }

  try {
    return await handlePaymentNotification(paymentId);
  } catch (err) {
    logServerError("api.billing.webhook", err);
    return NextResponse.json({ ok: false }, { status: 500, headers: NO_STORE });
  }
}

/** Mercado Pago también puede invocar GET en algunos entornos de prueba. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const paymentId = url.searchParams.get("data.id") ?? url.searchParams.get("id");
  if (!paymentId) {
    return NextResponse.json({ ok: true, ping: true }, { headers: NO_STORE });
  }

  const signatureOk = verifyMercadoPagoWebhookSignature({
    signatureHeader: request.headers.get("x-signature"),
    requestId: request.headers.get("x-request-id"),
    dataId: paymentId,
  });

  if (!signatureOk && getMercadoPagoWebhookSecret()) {
    return NextResponse.json({ error: "Firma inválida." }, { status: 401, headers: NO_STORE });
  }

  if (!getMercadoPagoWebhookSecret() && process.env.NODE_ENV === "production") {
    logServerError(
      "api.billing.webhook.missing_secret",
      new Error("MP_WEBHOOK_SECRET no configurado en producción")
    );
    return NextResponse.json(
      { error: "Webhook no configurado." },
      { status: 503, headers: NO_STORE }
    );
  }

  try {
    return await handlePaymentNotification(paymentId);
  } catch (err) {
    logServerError("api.billing.webhook.get", err);
    return NextResponse.json({ ok: false }, { status: 500, headers: NO_STORE });
  }
}
