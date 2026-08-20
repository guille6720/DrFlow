import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve(process.cwd(), "supabase/migrations/126_entitlement_usage_suspend.sql"),
  "utf8"
);

describe("126_entitlement_usage_suspend migration", () => {
  it("blocks metered consume when the commercial status is suspended", () => {
    expect(sql).toMatch(/entitlement_metered_commercially_blocked/);
    expect(sql).toMatch(/COMMERCIAL_SUSPENDED/);
    expect(sql).toMatch(/try_consume_feature_usage/);
    expect(sql).toMatch(/increment_feature_usage/);
    expect(sql).toMatch(/IS DISTINCT FROM 'override'/);
  });

  it("lets superadmin expire live overrides without deleting history", () => {
    expect(sql).toMatch(/clear_clinic_feature_override/);
    expect(sql).toMatch(/ends_at = now\(\)/);
    expect(sql).not.toMatch(/DELETE FROM public\.clinic_feature_overrides/);
  });

  it("does not replace Mercado Pago clinic_subscriptions", () => {
    expect(sql).not.toMatch(/DROP TABLE.*clinic_subscriptions/);
    expect(sql).not.toMatch(/ALTER TABLE public\.clinic_subscriptions/);
  });

  it("does not auto-apply to production", () => {
    expect(sql).toMatch(/Does not auto-apply to production/);
  });
});
