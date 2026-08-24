import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve(process.cwd(), "supabase/migrations/128_entitlement_trial_expire.sql"),
  "utf8"
);

describe("128_entitlement_trial_expire migration", () => {
  it("persists lapsed trialing rows to expired", () => {
    expect(sql).toMatch(/expire_lapsed_clinic_entitlement_trials/);
    expect(sql).toMatch(/status = 'expired'/);
    expect(sql).toMatch(/status = 'trialing'/);
    expect(sql).toMatch(/trial_ends_at <= now\(\)/);
    expect(sql).toMatch(/idx_clinic_entitlement_subs_one_live/);
  });

  it("expires on get_clinic_entitlements, trial end and status changes", () => {
    expect(sql).toMatch(/LANGUAGE plpgsql\s+VOLATILE/);
    expect(sql).toMatch(/PERFORM public\.expire_lapsed_clinic_entitlement_trials/);
    expect(sql).toMatch(/set_clinic_entitlement_trial_end/);
    expect(sql).toMatch(/set_clinic_entitlement_status/);
  });

  it("does not replace Mercado Pago clinic_subscriptions", () => {
    expect(sql).not.toMatch(/DROP TABLE.*clinic_subscriptions/);
    expect(sql).not.toMatch(/ALTER TABLE public\.clinic_subscriptions/);
    expect(sql).not.toMatch(/UPDATE public\.clinics/);
  });

  it("does not auto-apply to production", () => {
    expect(sql).toMatch(/Does not auto-apply to production/);
  });
});
