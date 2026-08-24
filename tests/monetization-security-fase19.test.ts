/**
 * Phase 19 — Monetization security tests (plans, catalog amount, webhook posture).
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";

import { getPlanPriceArs } from "@/core/billing/plans";
import {
  assertApprovedPaymentMatchesCatalog,
  evaluateMonetizationSecurityPosture,
  isActivatingPaymentStatus,
  isRefundOrChargebackStatus,
  MONETIZATION_LIFECYCLE,
  MONETIZATION_SECURITY_CONTROLS,
} from "@/core/compliance/monetization-security";

const ROOT = process.cwd();
const clinicId = "11111111-1111-1111-1111-111111111111";

function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), "utf8");
}

describe("monetization-security policy module", () => {
  it("lists security controls and lifecycle honesty", () => {
    expect(MONETIZATION_SECURITY_CONTROLS.map((c) => c.id)).toEqual(
      expect.arrayContaining([
        "webhook_authenticity",
        "idempotency",
        "server_catalog_price",
        "no_client_plan_forge",
        "checkout_session_bound",
        "payment_source_of_truth",
      ])
    );
    expect(MONETIZATION_LIFECYCLE.some((c) => c.id === "arca_invoicing" && c.status === "external")).toBe(
      true
    );
    expect(MONETIZATION_LIFECYCLE.some((c) => c.id === "cancellation" && c.status === "implemented")).toBe(
      true
    );
  });

  it("evaluateMonetizationSecurityPosture forbids client forge", () => {
    const posture = evaluateMonetizationSecurityPosture();
    expect(posture.clientCannotForgePaidPlan).toBe(true);
    expect(posture.amountMustMatchCatalog).toBe(true);
    expect(posture.webhookRequiresSecretInProduction).toBe(true);
    expect(posture.controlCount).toBeGreaterThanOrEqual(6);
  });

  it("only approved activates; refund/chargeback demote", () => {
    expect(isActivatingPaymentStatus("approved")).toBe(true);
    expect(isActivatingPaymentStatus("pending")).toBe(false);
    expect(isRefundOrChargebackStatus("refunded")).toBe(true);
    expect(isRefundOrChargebackStatus("charged_back")).toBe(true);
    expect(isRefundOrChargebackStatus("approved")).toBe(false);
  });
});

describe("assertApprovedPaymentMatchesCatalog", () => {
  const ref = { clinicId, planId: "solo" as const, cycle: "monthly" as const };
  const expected = getPlanPriceArs("solo", "monthly")!;

  it("accepts exact catalog amount in ARS", () => {
    const result = assertApprovedPaymentMatchesCatalog(
      { status: "approved", transaction_amount: expected, currency_id: "ARS" },
      ref
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.paidCents).toBe(Math.round(expected * 100));
    }
  });

  it("rejects underpay / overpay", () => {
    expect(
      assertApprovedPaymentMatchesCatalog(
        { status: "approved", transaction_amount: expected - 1, currency_id: "ARS" },
        ref
      ).ok
    ).toBe(false);
    expect(
      assertApprovedPaymentMatchesCatalog(
        { status: "approved", transaction_amount: expected + 100, currency_id: "ARS" },
        ref
      ).ok
    ).toBe(false);
  });

  it("rejects development plan and foreign currency", () => {
    expect(
      assertApprovedPaymentMatchesCatalog(
        { status: "approved", transaction_amount: 1, currency_id: "ARS" },
        { clinicId, planId: "clinica", cycle: "monthly" }
      ).ok
    ).toBe(false);
    expect(
      assertApprovedPaymentMatchesCatalog(
        { status: "approved", transaction_amount: expected, currency_id: "USD" },
        ref
      ).ok
    ).toBe(false);
  });

  it("rejects non-approved status", () => {
    expect(
      assertApprovedPaymentMatchesCatalog(
        { status: "pending", transaction_amount: expected, currency_id: "ARS" },
        ref
      ).ok
    ).toBe(false);
  });
});

describe("fase 19 wiring (static)", () => {
  it("processApprovedMercadoPagoPayment validates catalog amount", () => {
    const src = read("src/core/billing/subscription-service.ts");
    expect(src).toContain("assertApprovedPaymentMatchesCatalog");
    expect(src).toContain("processRefundOrChargebackMercadoPagoPayment");
  });

  it("webhook routes approved and refund/chargeback", () => {
    const src = read("src/app/api/billing/webhooks/mercadopago/route.ts");
    expect(src).toContain("isActivatingPaymentStatus");
    expect(src).toContain("isRefundOrChargebackStatus");
    expect(src).toContain("processRefundOrChargebackMercadoPagoPayment");
    expect(src).toContain("verifyMercadoPagoWebhookSignature");
    expect(src).toContain("MP_WEBHOOK_SECRET");
  });

  it("checkout preference binds session clinicId", () => {
    const src = read("src/app/api/billing/create-preference/route.ts");
    expect(src).toMatch(/access\.clinicId|clinicId/);
    expect(src).toContain("createCheckoutPreference");
  });

  it("subscriptions RLS is select-only for clients", () => {
    const sql = read("supabase/migrations/100_clinic_subscriptions.sql");
    expect(sql).toContain("clinic_subscriptions_select");
    expect(sql).toContain("mercado_pago_payment_id TEXT NOT NULL UNIQUE");
    expect(sql).not.toMatch(/CREATE POLICY clinic_subscriptions_insert/i);
    expect(sql).not.toMatch(/CREATE POLICY clinic_subscriptions_update/i);
  });

  it("entitlement assign requires superadmin/service_role", () => {
    const sql = read("supabase/migrations/122_entitlement_superadmin.sql");
    expect(sql).toContain("assert_entitlement_superadmin");
    expect(sql).toContain("assign_clinic_entitlement_plan");
  });
});
