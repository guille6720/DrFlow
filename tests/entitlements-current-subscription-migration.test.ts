import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve(process.cwd(), "supabase/migrations/125_entitlement_current_subscription.sql"),
  "utf8"
);

describe("125_entitlement_current_subscription migration", () => {
  it("picks live subscriptions first then the latest suspended row", () => {
    expect(sql).toMatch(/clinic_current_entitlement_subscription_id/);
    expect(sql).toMatch(/CASE WHEN s\.status IN \('trialing', 'active'\) THEN 0 ELSE 1 END/);
    expect(sql).toMatch(/get_clinic_entitlements/);
    expect(sql).toMatch(/resolve_clinic_feature_entitlement/);
  });

  it("lets superadmin restore active or trialing", () => {
    expect(sql).toMatch(/'trialing', 'active', 'past_due', 'cancelled', 'expired'/);
    expect(sql).toMatch(/WHEN v_status IN \('trialing', 'active'\) THEN NULL/);
  });

  it("closes past_due when assigning a new plan", () => {
    expect(sql).toMatch(/status IN \('trialing', 'active', 'past_due'\)/);
  });

  it("does not replace Mercado Pago clinic_subscriptions", () => {
    expect(sql).not.toMatch(/DROP TABLE.*clinic_subscriptions/);
    expect(sql).not.toMatch(/ALTER TABLE public\.clinic_subscriptions/);
  });

  it("does not auto-apply to production", () => {
    expect(sql).toMatch(/Does not auto-apply to production/);
  });
});
