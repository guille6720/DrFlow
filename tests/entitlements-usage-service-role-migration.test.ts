import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve(process.cwd(), "supabase/migrations/123_entitlement_usage_service_role.sql"),
  "utf8"
);

describe("123_entitlement_usage_service_role migration", () => {
  it("lets service_role consume usage without replacing clinic_subscriptions", () => {
    expect(sql).toMatch(/assert_entitlement_clinic_access/);
    expect(sql).toMatch(/auth\.role\(\), ''\) = 'service_role'/);
    expect(sql).toMatch(/MISSING_ENTITLEMENT_CATALOG/);
    expect(sql).toMatch(/121_commercial_entitlements/);
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.try_consume_feature_usage/);
    expect(sql).toMatch(/TO service_role/);
    expect(sql).not.toMatch(/DROP TABLE.*clinic_subscriptions/);
  });

  it("does not auto-apply to production", () => {
    expect(sql).toMatch(/Does not auto-apply to production/);
  });
});
