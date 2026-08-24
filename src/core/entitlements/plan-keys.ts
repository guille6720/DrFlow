/**
 * Database-driven plan keys. Application logic must never branch on plan
 * (e.g. `if (plan === "premium")`). Resolve entitlements via features instead.
 */
export const PLAN_KEYS = {
  TRIAL: "trial",
  /** Public commercial SKU — 1 professional, no AI. */
  ESSENTIAL: "essential",
  BASIC: "basic",
  PRO: "pro",
  PREMIUM: "premium",
  ENTERPRISE: "enterprise",
  /** Internal migration-only plan. Never assign on automatic onboarding. */
  LEGACY: "legacy",
} as const;

export type PlanKey = (typeof PLAN_KEYS)[keyof typeof PLAN_KEYS];

export const ONBOARDING_PLAN_KEY = PLAN_KEYS.TRIAL;
export const MIGRATION_PLAN_KEY = PLAN_KEYS.LEGACY;

export type PlanAssignmentFlags = {
  key: string;
  is_internal: boolean;
  is_public: boolean;
  metadata?: Record<string, unknown> | null;
};

export function isInternalOrLegacyPlan(plan: PlanAssignmentFlags): boolean {
  const metadata = plan.metadata ?? {};
  return (
    plan.is_internal ||
    !plan.is_public ||
    plan.key === PLAN_KEYS.LEGACY ||
    metadata.internal === true ||
    metadata.migration_only === true
  );
}

export function isPlanAssignableOnOnboarding(plan: PlanAssignmentFlags): boolean {
  return plan.key === ONBOARDING_PLAN_KEY && !isInternalOrLegacyPlan(plan);
}
