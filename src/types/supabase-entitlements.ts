/**
 * Typed subset / aliases for commercial entitlements (migrations 121–128).
 * Sourced from the generated Database type (`supabase gen types` → staging).
 * Do not hand-edit table shapes here — regenerate `src/types/supabase.ts`.
 */
import type { Database, Json } from "@/types/supabase";

export type { Json };

type PublicTables = Database["public"]["Tables"];
type PublicFunctions = Database["public"]["Functions"];

export type EntitlementsDatabase = {
  public: {
    Tables: Pick<
      PublicTables,
      | "plans"
      | "features"
      | "plan_features"
      | "clinic_entitlement_subscriptions"
      | "clinic_feature_overrides"
      | "feature_usage"
    >;
    Views: Record<string, never>;
    Functions: Pick<
      PublicFunctions,
      | "clinic_current_entitlement_subscription_id"
      | "get_clinic_entitlements"
      | "increment_feature_usage"
      | "try_consume_feature_usage"
      | "resolve_clinic_feature_entitlement"
      | "assert_entitlement_clinic_access"
      | "assert_entitlement_superadmin"
      | "assign_clinic_entitlement_plan"
      | "upsert_clinic_feature_override"
      | "get_clinic_entitlement_usage"
      | "set_clinic_entitlement_status"
      | "entitlement_metered_commercially_blocked"
      | "clear_clinic_feature_override"
      | "entitlement_subscription_is_live"
      | "set_clinic_entitlement_trial_end"
      | "expire_lapsed_clinic_entitlement_trials"
    >;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type PlansRow = PublicTables["plans"]["Row"];
export type FeaturesRow = PublicTables["features"]["Row"];
export type PlanFeaturesRow = PublicTables["plan_features"]["Row"];
export type ClinicEntitlementSubscriptionRow =
  PublicTables["clinic_entitlement_subscriptions"]["Row"];
export type ClinicFeatureOverrideRow = PublicTables["clinic_feature_overrides"]["Row"];
export type FeatureUsageRow = PublicTables["feature_usage"]["Row"];
