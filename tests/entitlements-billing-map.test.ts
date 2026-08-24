import { describe, expect, it } from "vitest";

import { commercialPlanKeyFromBillingPlan } from "@/core/entitlements/billing-plan-map";
import { PLAN_KEYS } from "@/core/entitlements/plan-keys";

describe("Mercado Pago billing → commercial catalog adapter", () => {
  it("maps Essential/Pro and historic Solo/Consultorio/Clínica", () => {
    expect(commercialPlanKeyFromBillingPlan("essential")).toBe(PLAN_KEYS.ESSENTIAL);
    expect(commercialPlanKeyFromBillingPlan("pro")).toBe(PLAN_KEYS.PRO);
    expect(commercialPlanKeyFromBillingPlan("solo")).toBe(PLAN_KEYS.BASIC);
    expect(commercialPlanKeyFromBillingPlan("consultorio")).toBe(PLAN_KEYS.PRO);
    expect(commercialPlanKeyFromBillingPlan("clinica")).toBe(PLAN_KEYS.PREMIUM);
  });
});
