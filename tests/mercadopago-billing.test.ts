import { createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  buildExternalReference,
  parseExternalReference,
  paymentAmountToCents,
  subscriptionPeriodEndFromCycle,
  verifyMercadoPagoWebhookSignature,
} from "@/core/billing/mercadopago";
import {
  billingCycleLabel,
  getPlanMercadoPagoSku,
  getPlanPriceArs,
} from "@/core/billing/plans";

describe("billing plans helpers", () => {
  it("resolves monthly and annual prices", () => {
    expect(getPlanPriceArs("solo", "monthly")).toBe(24_900);
    expect(getPlanPriceArs("solo", "annual")).toBe(249_000);
    expect(getPlanPriceArs("clinica", "monthly")).toBeNull();
  });

  it("builds mercado pago sku per cycle", () => {
    expect(getPlanMercadoPagoSku("consultorio", "monthly")).toBe("drflow-consultorio-mensual");
    expect(getPlanMercadoPagoSku("consultorio", "annual")).toBe("drflow-consultorio-anual");
    expect(billingCycleLabel("annual")).toBe("Anual");
  });
});

describe("mercadopago external reference", () => {
  const clinicId = "11111111-1111-1111-1111-111111111111";

  it("roundtrips clinic plan cycle", () => {
    const ref = buildExternalReference({ clinicId, planId: "solo", cycle: "monthly" });
    expect(parseExternalReference(ref)).toEqual({
      clinicId,
      planId: "solo",
      cycle: "monthly",
    });
  });

  it("rejects malformed reference", () => {
    expect(parseExternalReference("bad")).toBeNull();
    expect(parseExternalReference(`${clinicId}:solo:weekly`)).toBeNull();
  });
});

describe("verifyMercadoPagoWebhookSignature", () => {
  it("validates HMAC signature from MP manifest", () => {
    const secret = "test-webhook-secret";
    const dataId = "12345";
    const requestId = "req-abc";
    const ts = "1704908010";
    const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
    const v1 = createHmac("sha256", secret).update(manifest).digest("hex");

    expect(
      verifyMercadoPagoWebhookSignature({
        signatureHeader: `ts=${ts},v1=${v1}`,
        requestId,
        dataId,
        secret,
      })
    ).toBe(true);
  });

  it("rejects invalid signature", () => {
    expect(
      verifyMercadoPagoWebhookSignature({
        signatureHeader: "ts=1,v1=deadbeef",
        requestId: "x",
        dataId: "1",
        secret: "secret",
      })
    ).toBe(false);
  });
});

describe("paymentAmountToCents", () => {
  it("converts ARS decimal to cents", () => {
    expect(paymentAmountToCents(24900)).toBe(2_490_000);
    expect(paymentAmountToCents(0)).toBeNull();
  });
});

describe("subscriptionPeriodEndFromCycle", () => {
  it("adds one month for monthly cycle", () => {
    const from = new Date("2026-01-15T12:00:00.000Z");
    const end = subscriptionPeriodEndFromCycle("monthly", from);
    expect(new Date(end).getUTCMonth()).toBe(1);
  });
});

describe("clinic_subscription_active migration", () => {
  it("includes subscription table in SQL definition", async () => {
    const fs = await import("node:fs/promises");
    const sql = await fs.readFile(
      "supabase/migrations/100_clinic_subscriptions.sql",
      "utf8"
    );
    expect(sql).toMatch(/clinic_subscriptions/);
    expect(sql).toMatch(/status IN \('active', 'manual'\)/);
  });
});

describe("buildSubscriptionReceiptEmailContent", () => {
  it("includes plan and amount in receipt", async () => {
    const { buildSubscriptionReceiptEmailContent } = await import(
      "@/lib/services/subscription-receipt-email"
    );
    const content = buildSubscriptionReceiptEmailContent({
      clinicName: "Consultorio Test",
      planName: "Solo",
      cycleLabel: "Mensual",
      amountLabel: "$ 24.900",
      periodEndLabel: "15 de marzo de 2026",
    });
    expect(content.subject).toContain("Solo");
    expect(content.text).toContain("Consultorio Test");
    expect(content.text).toContain("$ 24.900");
  });
});
