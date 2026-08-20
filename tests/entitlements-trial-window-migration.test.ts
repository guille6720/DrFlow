import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve(process.cwd(), "supabase/migrations/127_entitlement_trial_window.sql"),
  "utf8"
);

describe("127_entitlement_trial_window migration", () => {
  it("treats lapsed trialing as not live when trial_ends_at is set", () => {
    expect(sql).toMatch(/entitlement_subscription_is_live/);
    expect(sql).toMatch(/p_trial_ends_at IS NULL OR p_trial_ends_at > now\(\)/);
    expect(sql).toMatch(/clinic_current_entitlement_subscription_id/);
    expect(sql).toMatch(/v_status := 'expired'/);
  });

  it("blocks metered consume on a lapsed commercial trial unless override", () => {
    expect(sql).toMatch(/entitlement_metered_commercially_blocked/);
    expect(sql).toMatch(/NOT public\.entitlement_subscription_is_live/);
    expect(sql).toMatch(/IS DISTINCT FROM 'override'/);
  });

  it("lets superadmin set or clear commercial trial_ends_at", () => {
    expect(sql).toMatch(/set_clinic_entitlement_trial_end/);
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.set_clinic_entitlement_trial_end/);
    expect(sql).not.toMatch(/UPDATE public\.clinics/);
  });

  it("does not replace Mercado Pago clinic_subscriptions", () => {
    expect(sql).not.toMatch(/DROP TABLE.*clinic_subscriptions/);
    expect(sql).not.toMatch(/ALTER TABLE public\.clinic_subscriptions/);
  });

  it("does not auto-apply to production", () => {
    expect(sql).toMatch(/Does not auto-apply to production/);
  });
});
