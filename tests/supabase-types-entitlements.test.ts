import { describe, expect, it } from "vitest";

import type { Database } from "@/types/supabase";
import type { EntitlementsDatabase } from "@/types/supabase-entitlements";

type PublicTables = Database["public"]["Tables"];
type PublicFunctions = Database["public"]["Functions"];

describe("generated Supabase Database types", () => {
  it("includes commercial entitlement tables", () => {
    type Plans = PublicTables["plans"]["Row"];
    type Features = PublicTables["features"]["Row"];
    type Subs = PublicTables["clinic_entitlement_subscriptions"]["Row"];
    type Overrides = PublicTables["clinic_feature_overrides"]["Row"];
    type Usage = PublicTables["feature_usage"]["Row"];

    const plan = { key: "basic" } as Pick<Plans, "key">;
    const feature = { key: "ai.enabled", usage_metered: true } as Pick<
      Features,
      "key" | "usage_metered"
    >;
    const sub = { status: "active" } as Pick<Subs, "status">;
    const override = { enabled: true } as Pick<Overrides, "enabled">;
    const usage = { amount: 0 } as Pick<Usage, "amount">;

    expect(plan.key).toBe("basic");
    expect(feature.usage_metered).toBe(true);
    expect(sub.status).toBe("active");
    expect(override.enabled).toBe(true);
    expect(usage.amount).toBe(0);
  });

  it("includes entitlement RPCs used by the app", () => {
    type GetEntitlements = PublicFunctions["get_clinic_entitlements"];
    type Assign = PublicFunctions["assign_clinic_entitlement_plan"];
    type Consume = PublicFunctions["try_consume_feature_usage"];
    type Clear = PublicFunctions["clear_clinic_feature_override"];
    type Expire = PublicFunctions["expire_lapsed_clinic_entitlement_trials"];

    const getArgs = { p_clinic_id: "x" } satisfies GetEntitlements["Args"];
    const assignArgs = {
      p_clinic_id: "x",
      p_plan_key: "basic",
    } satisfies Assign["Args"];
    const consumeArgs = {
      p_clinic_id: "x",
      p_feature_key: "ai.monthly_requests",
      p_amount: 1,
    } satisfies Consume["Args"];
    const clearArgs = {
      p_clinic_id: "x",
      p_feature_key: "portal.enabled",
    } satisfies Clear["Args"];
    const expireArgs = { p_clinic_id: "x" } satisfies Expire["Args"];

    expect(getArgs.p_clinic_id).toBe("x");
    expect(assignArgs.p_plan_key).toBe("basic");
    expect(consumeArgs.p_amount).toBe(1);
    expect(clearArgs.p_feature_key).toBe("portal.enabled");
    expect(expireArgs.p_clinic_id).toBe("x");
  });

  it("keeps EntitlementsDatabase as a typed subset of Database", () => {
    type SubPlans = EntitlementsDatabase["public"]["Tables"]["plans"]["Row"];
    type DbPlans = PublicTables["plans"]["Row"];
    const same: SubPlans = {} as DbPlans;
    expect(same).toBeDefined();
  });
});
