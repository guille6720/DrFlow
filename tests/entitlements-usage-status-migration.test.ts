import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve(process.cwd(), "supabase/migrations/124_entitlement_usage_status.sql"),
  "utf8"
);

describe("124_entitlement_usage_status migration", () => {
  it("adds usage snapshot and superadmin status RPCs", () => {
    expect(sql).toMatch(/MISSING_ENTITLEMENT_CATALOG/);
    expect(sql).toMatch(/get_clinic_entitlement_usage/);
    expect(sql).toMatch(/set_clinic_entitlement_status/);
    expect(sql).toMatch(/assert_entitlement_superadmin/);
    expect(sql).toMatch(/past_due/);
    expect(sql).toMatch(/NO_LIVE_SUBSCRIPTION/);
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.get_clinic_entitlement_usage/);
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.set_clinic_entitlement_status/);
    expect(sql).toMatch(/TO authenticated, service_role/);
  });

  it("does not replace Mercado Pago clinic_subscriptions", () => {
    expect(sql).not.toMatch(/DROP TABLE.*clinic_subscriptions/);
    expect(sql).not.toMatch(/ALTER TABLE public\.clinic_subscriptions/);
  });

  it("does not auto-apply to production", () => {
    expect(sql).toMatch(/Does not auto-apply to production/);
  });
});
