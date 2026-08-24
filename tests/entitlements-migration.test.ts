import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";

import { FEATURES } from "@/core/entitlements/features";
import { PLAN_KEYS } from "@/core/entitlements/plan-keys";

const sql = readFileSync(
  resolve(process.cwd(), "supabase/migrations/121_commercial_entitlements.sql"),
  "utf8"
);

describe("121_commercial_entitlements migration", () => {
  it("creates catalog and tenant tables", () => {
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.plans/);
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.features/);
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.plan_features/);
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.clinic_entitlement_subscriptions/);
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.clinic_feature_overrides/);
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.feature_usage/);
  });

  it("enables RLS and has no write policies for authenticated catalog/tenant tables", () => {
    for (const table of [
      "plans",
      "features",
      "plan_features",
      "clinic_entitlement_subscriptions",
      "clinic_feature_overrides",
      "feature_usage",
    ]) {
      expect(sql).toMatch(
        new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`)
      );
    }
    expect(sql).not.toMatch(/CREATE POLICY \w+ ON public\.plans\s+FOR INSERT/i);
    expect(sql).not.toMatch(
      /CREATE POLICY \w+ ON public\.clinic_entitlement_subscriptions\s+FOR INSERT/i
    );
    expect(sql).toMatch(/REVOKE ALL ON TABLE public\.plans FROM PUBLIC, anon, authenticated/);
    expect(sql).toMatch(/GRANT SELECT ON TABLE public\.clinic_entitlement_subscriptions TO authenticated/);
  });

  it("backfills existing clinics to legacy active once", () => {
    expect(sql).toMatch(/p\.key = 'legacy'/);
    expect(sql).toMatch(/'active'/);
    expect(sql).toMatch(/legacy_backfill/);
    expect(sql).toMatch(/WHERE NOT EXISTS/);
    expect(sql).toMatch(/ON CONFLICT DO NOTHING/);
  });

  it("onboards new clinics to trial trialing and never legacy", () => {
    expect(sql).toMatch(/onboard_clinic_entitlement_subscription/);
    expect(sql).toMatch(/key = 'trial'/);
    expect(sql).toMatch(/'trialing'/);
    expect(sql).toMatch(/plan_forbidden_for_automatic_assignment/);
    expect(sql).toMatch(/ONBOARDING_PLAN_MISSING/);
    expect(sql).toMatch(/ONBOARDING_PLAN_FORBIDDEN/);
    expect(sql).toMatch(/AFTER INSERT ON public\.clinics/);
    expect(sql).not.toMatch(/onboard_clinic_entitlement_subscription[\s\S]*key = 'legacy'/);
  });

  it("protects the legacy plan as internal / not public", () => {
    expect(sql).toMatch(/'legacy'/);
    expect(sql).toMatch(/is_internal BOOLEAN NOT NULL DEFAULT false/);
    expect(sql).toMatch(/is_public BOOLEAN NOT NULL DEFAULT true/);
    expect(sql).toMatch(/"migration_only": true/);
    expect(sql).toMatch(/"assignable_only_by_superadmin": true/);
    expect(sql).toMatch(/p_plan\.key = 'legacy'/);
  });

  it("does not hardcode a trial duration", () => {
    expect(sql).toMatch(/"trial_duration_days": null/);
    expect(sql).toMatch(/'trialing'/);
    expect(sql).toMatch(/now\(\),\s+NULL,\s+jsonb_build_object\('source', 'clinic_insert_trigger'\)/);
  });

  it("seeds typed feature keys used by the application constants", () => {
    expect(sql).toContain(`'${FEATURES.PAMI}'`);
    expect(sql).toContain(`'${FEATURES.AI_CLINICAL_SUMMARY}'`);
    expect(sql).toContain(`'${FEATURES.WHATSAPP}'`);
    expect(sql).toContain(`'${PLAN_KEYS.BASIC}'`);
    expect(sql).toContain(`'${PLAN_KEYS.PREMIUM}'`);
    expect(sql).toContain(`'${PLAN_KEYS.ENTERPRISE}'`);
  });

  it("casts plan_features.value seed expressions to jsonb", () => {
    expect(sql).toMatch(/THEN NULL::jsonb ELSE NULL::jsonb END/);
    expect(sql).toMatch(/THEN '0'::jsonb ELSE NULL::jsonb END/);
  });

  it("defines secure usage RPCs with tenant checks and atomic upsert", () => {
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.increment_feature_usage/);
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.try_consume_feature_usage/);
    expect(sql).toMatch(/assert_entitlement_clinic_access/);
    expect(sql).toMatch(/INVALID_AMOUNT/);
    expect(sql).toMatch(/UNKNOWN_FEATURE/);
    expect(sql).toMatch(/FEATURE_NOT_METERED/);
    expect(sql).toMatch(/ON CONFLICT \(clinic_id, feature_id, period_start\)/);
    expect(sql).toMatch(/amount = public\.feature_usage\.amount \+ EXCLUDED\.amount/);
    expect(sql).toMatch(/SECURITY DEFINER/);
    expect(sql).toMatch(/SET search_path = public/);
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.increment_feature_usage/);
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.increment_feature_usage/);
  });

  it("loads entitlements in one RPC without client N\+1", () => {
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.get_clinic_entitlements/);
    expect(sql).toMatch(/jsonb_object_agg/);
    expect(sql).toMatch(/live_overrides/);
  });

  it("keeps Mercado Pago clinic_subscriptions intact", () => {
    expect(sql).not.toMatch(/DROP TABLE.*clinic_subscriptions/);
    expect(sql).not.toMatch(/ALTER TABLE clinic_subscriptions/);
  });
});
