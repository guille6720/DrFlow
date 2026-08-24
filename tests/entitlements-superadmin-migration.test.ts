import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve(process.cwd(), "supabase/migrations/122_entitlement_superadmin.sql"),
  "utf8"
);

describe("122_entitlement_superadmin migration", () => {
  it("adds superadmin and service_role assignment RPCs", () => {
    expect(sql).toMatch(/assert_entitlement_superadmin/);
    expect(sql).toMatch(/assign_clinic_entitlement_plan/);
    expect(sql).toMatch(/upsert_clinic_feature_override/);
    expect(sql).toMatch(/is_superadmin\(\)/);
    expect(sql).toMatch(/auth\.role\(\), ''\) = 'service_role'/);
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.assign_clinic_entitlement_plan/);
    expect(sql).toMatch(/TO authenticated, service_role/);
  });

  it("does not replace Mercado Pago clinic_subscriptions", () => {
    expect(sql).not.toMatch(/DROP TABLE.*clinic_subscriptions/);
    expect(sql).not.toMatch(/ALTER TABLE public\.clinic_subscriptions/);
  });

  it("lets superadmin assign legacy while keeping automatic onboarding separate", () => {
    expect(sql).toMatch(/incluye legacy/);
    expect(sql).toMatch(/Onboarding automático sigue sin poder asignar legacy/);
    expect(sql).toMatch(/mercadopago_payment/);
  });

  it("does not auto-apply to production", () => {
    expect(sql).toMatch(/Does not auto-apply to production/);
  });
});
