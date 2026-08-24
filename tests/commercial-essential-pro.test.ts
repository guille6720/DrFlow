/**
 * Commercial Essential/Pro pricing, promo window, upgrade, limits messages, amount security.
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";

import { resolveCheckoutAmountArs } from "@/core/billing/checkout-amount";
import {
  addBillingMonths,
  buildNewSubscriptionPromoSnapshot,
  buildUpgradeProPromoFields,
  COMMERCIAL_SKU_PRICING,
  computePromoWindow,
  resolveEffectivePrice,
} from "@/core/billing/commercial-pricing";
import { parseExternalReference } from "@/core/billing/mercadopago";
import {
  classifyPlanChange,
  evaluateDowngradeToEssential,
  shouldPreservePromoWindowOnUpgrade,
} from "@/core/billing/plan-change";
import {
  getBillingPlan,
  getPlanPriceArs,
  isPlanAvailableForPurchase,
  TRIAL_DAYS_INCLUDED,
} from "@/core/billing/plans";
import { assertApprovedPaymentMatchesCatalog } from "@/core/compliance/monetization-security";
import { decideSeatCapacity } from "@/core/entitlements/limits";
import { TRIAL_PROMO_DAYS } from "@/core/trial/clinic-trial";

const ROOT = process.cwd();
const clinicId = "11111111-1111-1111-1111-111111111111";

describe("commercial Essential/Pro catalog", () => {
  it("publishes promo and regular prices", () => {
    expect(COMMERCIAL_SKU_PRICING.essential.promoPriceArs).toBe(25_000);
    expect(COMMERCIAL_SKU_PRICING.essential.regularPriceArs).toBe(35_000);
    expect(COMMERCIAL_SKU_PRICING.pro.promoPriceArs).toBe(40_000);
    expect(COMMERCIAL_SKU_PRICING.pro.regularPriceArs).toBe(55_000);
    expect(isPlanAvailableForPurchase(getBillingPlan("essential")!)).toBe(true);
    expect(isPlanAvailableForPurchase(getBillingPlan("pro")!)).toBe(true);
    expect(isPlanAvailableForPurchase(getBillingPlan("solo")!)).toBe(false);
  });

  it("trial is 14 days", () => {
    expect(TRIAL_DAYS_INCLUDED).toBe(14);
    expect(TRIAL_PROMO_DAYS).toBe(14);
  });
});

describe("resolveEffectivePrice billing months", () => {
  const start = new Date("2026-01-15T12:00:00.000Z");
  const { promoEndsAt } = computePromoWindow(start, 6);

  it("month 1 and month 6 stay promotional for Essential", () => {
    const m1 = resolveEffectivePrice({
      planId: "essential",
      promoStartedAt: start,
      promoEndsAt,
      promoPriceArs: 25_000,
      regularPriceArs: 35_000,
      at: new Date("2026-01-20T12:00:00.000Z"),
    });
    expect(m1?.phase).toBe("promotional");
    expect(m1?.amountArs).toBe(25_000);

    const m6 = resolveEffectivePrice({
      planId: "essential",
      promoStartedAt: start,
      promoEndsAt,
      promoPriceArs: 25_000,
      regularPriceArs: 35_000,
      at: addBillingMonths(start, 5),
    });
    expect(m6?.phase).toBe("promotional");
    expect(m6?.amountArs).toBe(25_000);
  });

  it("month 7 uses regular Essential price", () => {
    const m7 = resolveEffectivePrice({
      planId: "essential",
      promoStartedAt: start,
      promoEndsAt,
      promoPriceArs: 25_000,
      regularPriceArs: 35_000,
      at: promoEndsAt,
    });
    expect(m7?.phase).toBe("regular");
    expect(m7?.amountArs).toBe(35_000);
  });

  it("Pro m1 promo and m7 regular", () => {
    const m1 = resolveEffectivePrice({
      planId: "pro",
      promoStartedAt: start,
      promoEndsAt,
      promoPriceArs: 40_000,
      regularPriceArs: 55_000,
      at: start,
    });
    expect(m1?.amountArs).toBe(40_000);
    const m7 = resolveEffectivePrice({
      planId: "pro",
      promoStartedAt: start,
      promoEndsAt,
      promoPriceArs: 40_000,
      regularPriceArs: 55_000,
      at: promoEndsAt,
    });
    expect(m7?.amountArs).toBe(55_000);
  });
});

describe("upgrade does not restart promo", () => {
  it("buildUpgradeProPromoFields keeps original ends_at", () => {
    const snap = buildNewSubscriptionPromoSnapshot(
      "essential",
      new Date("2026-03-01T00:00:00.000Z")
    );
    const upgraded = buildUpgradeProPromoFields({
      promo_started_at: snap.promo_started_at,
      promo_ends_at: snap.promo_ends_at,
      promo_months: snap.promo_months,
    });
    expect(upgraded.promo_ends_at).toBe(snap.promo_ends_at);
    expect(upgraded.promo_price_amount).toBe(40_000);
    expect(upgraded.regular_price_amount).toBe(55_000);
    expect(shouldPreservePromoWindowOnUpgrade(classifyPlanChange("essential", "pro"))).toBe(true);
  });

  it("checkout amount on upgrade uses Pro promo until original end", () => {
    const start = new Date("2026-01-15T12:00:00.000Z");
    const { promoEndsAt } = computePromoWindow(start, 6);
    const amount = resolveCheckoutAmountArs({
      planId: "pro",
      cycle: "monthly",
      snapshot: {
        plan_id: "essential",
        promo_started_at: start.toISOString(),
        promo_ends_at: promoEndsAt.toISOString(),
        promo_months: 6,
        promo_price_amount: 25_000,
        regular_price_amount: 35_000,
      },
      at: new Date("2026-03-01T12:00:00.000Z"),
    });
    expect(amount).toBe(40_000);
  });
});

describe("downgrade / seats / AI messaging", () => {
  it("blocks downgrade when more than 1 professional", () => {
    expect(evaluateDowngradeToEssential({ activeProfessionals: 2 }).ok).toBe(false);
    expect(evaluateDowngradeToEssential({ activeProfessionals: 1 }).ok).toBe(true);
  });

  it("rejects 2nd professional on Essential seat limit 1", () => {
    const blocked = decideSeatCapacity({
      enforced: true,
      catalogAvailable: true,
      limit: 1,
      currentCount: 1,
      featureKey: "professionals.max",
    });
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.error).toMatch(/1 profesional/);
  });

  it("rejects 6th professional on Pro seat limit 5", () => {
    const blocked = decideSeatCapacity({
      enforced: true,
      catalogAvailable: true,
      limit: 5,
      currentCount: 5,
      featureKey: "professionals.max",
    });
    expect(blocked.ok).toBe(false);
  });
});

describe("amount forge / webhook mismatch", () => {
  it("rejects manipulated frontend underpay on Essential", () => {
    const expected = getPlanPriceArs("essential", "monthly")!;
    const result = assertApprovedPaymentMatchesCatalog(
      { status: "approved", transaction_amount: expected - 1000, currency_id: "ARS" },
      { clinicId, planId: "essential", cycle: "monthly" }
    );
    expect(result.ok).toBe(false);
  });

  it("accepts promo amount and rejects wrong currency", () => {
    expect(
      assertApprovedPaymentMatchesCatalog(
        { status: "approved", transaction_amount: 25_000, currency_id: "ARS" },
        { clinicId, planId: "essential", cycle: "monthly" }
      ).ok
    ).toBe(true);
    expect(
      assertApprovedPaymentMatchesCatalog(
        { status: "approved", transaction_amount: 25_000, currency_id: "USD" },
        { clinicId, planId: "essential", cycle: "monthly" }
      ).ok
    ).toBe(false);
  });

  it("parses essential/pro external_reference; legacy solo still parseable", () => {
    expect(parseExternalReference(`${clinicId}:essential:monthly`)?.planId).toBe("essential");
    expect(parseExternalReference(`${clinicId}:pro:monthly`)?.planId).toBe("pro");
    expect(parseExternalReference(`${clinicId}:solo:monthly`)?.planId).toBe("solo");
  });
});

describe("migration 138 + no clinic DELETE", () => {
  it("138 adds promo columns and essential plan without deleting clinics", () => {
    const sql = readFileSync(
      resolve(ROOT, "supabase/migrations/138_commercial_essential_pro.sql"),
      "utf8"
    );
    expect(sql).toMatch(/promo_ends_at/);
    expect(sql).toMatch(/'essential'/);
    expect(sql).toMatch(/25600/);
    expect(sql).toMatch(/1000/);
    expect(sql).not.toMatch(/DELETE\s+FROM\s+(public\.)?clinics/i);
    expect(sql).not.toMatch(/UPDATE\s+public\.clinic_entitlement_subscriptions/i);
  });
});
