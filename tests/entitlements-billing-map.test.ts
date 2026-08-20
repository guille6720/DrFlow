import { describe, expect, it } from "vitest";

import { commercialPlanKeyFromBillingPlan } from "@/core/entitlements/billing-plan-map";
import { PLAN_KEYS } from "@/core/entitlements/plan-keys";

describe("Mercado Pago billing → commercial catalog adapter", () => {
  it("maps Solo/Consultorio/Clínica without replacing clinic_subscriptions", () => {
    expect(commercialPlanKeyFromBillingPlan("solo")).toBe(PLAN_KEYS.BASIC);
    expect(commercialPlanKeyFromBillingPlan("consultorio")).toBe(PLAN_KEYS.PRO);
    expect(commercialPlanKeyFromBillingPlan("clinica")).toBe(PLAN_KEYS.PREMIUM);
  });
});
