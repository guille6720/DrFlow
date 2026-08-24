export {
  countsTowardAutomationsMaxActive,
  isAutomationLikeClinicJobRow,
} from "@/core/entitlements/automation-jobs";
export { BILLING_TO_COMMERCIAL_PLAN, commercialPlanKeyFromBillingPlan } from "@/core/entitlements/billing-plan-map";
export {
  addonFeatureForClinicalAiTask,
  addonFeaturesForClinicalAiTask,
} from "@/core/entitlements/clinical-ai-features";
export {
  ADDON_SUSPENDED_MESSAGE,
  commercialStatusLabel,
  effectiveCommercialStatus,
  isLapsedCommercialTrial,
  isLiveCommercialStatus,
  isMeteredBlockedByCommercialStatus,
  isSuspendedCommercialStatus,
  pickCurrentEntitlementSubscription,
} from "@/core/entitlements/commercial-status";
export {
  CONFIGURACION_SECTION_ENTITLEMENT,
  configuracionSectionFeature,
  isConfiguracionSectionEntitledBySnapshot,
} from "@/core/entitlements/config-features";
export { addonFeatureForDatosExportFlujo } from "@/core/entitlements/datos-features";
export {
  ADDON_GATED_FEATURES,
  CORE_UNGATED_FEATURES,
  ENTITLEMENT_ENFORCEMENT_ENABLED,
  EXISTING_MODULE_ENFORCEMENT_DEFERRED,
  isAddonGatedFeature,
  isAutomationLimitEnforced,
  isCoreUngatedFeature,
  isEntitlementEnforcementEnabled,
  isExistingModuleEnforcementDeferred,
  isFeatureEnforced,
  isSeatLimitEnforced,
  isStorageLimitEnforced,
  SEAT_LIMIT_FEATURES,
} from "@/core/entitlements/enforcement";
export { commercialFeatureLabel } from "@/core/entitlements/feature-labels";
export {
  type FeatureKey,
  FEATURES,
  isFeatureKey,
  isLimitFeature,
  isMeteredFeature,
  LIMIT_FEATURES,
  METERED_FEATURES,
} from "@/core/entitlements/features";
export { addonFeatureForClinicFeatureFlag, isFlagEntitledBySnapshot } from "@/core/entitlements/flag-features";
export { addonFeatureForClinicJob, addonFeaturesForClinicJob } from "@/core/entitlements/job-features";
export { decideSeatCapacity, remainingSeatHeadroom } from "@/core/entitlements/limits";
export { decideMeteredUsageGate, isUsageRpcUnavailable } from "@/core/entitlements/metered-gate";
export {
  areFeaturesEntitledBySnapshot,
  listCommercialModuleAvailability,
  VISIBLE_COMMERCIAL_MODULES,
} from "@/core/entitlements/module-summary";
export {
  filterEntitledHrefItems,
  isHrefEntitledBySnapshot,
  NAV_ENTITLEMENT_BY_HREF,
  navFeatureForHref,
} from "@/core/entitlements/nav-features";
export { diffPlanFeatures, type PlanDiff } from "@/core/entitlements/plan-diff";
export {
  isInternalOrLegacyPlan,
  isPlanAssignableOnOnboarding,
  MIGRATION_PLAN_KEY,
  ONBOARDING_PLAN_KEY,
  PLAN_KEYS,
  type PlanKey,
} from "@/core/entitlements/plan-keys";
export {
  getPlanRecommendation,
  type PlanRecommendationInput,
  type PlanRecommendationResult,
} from "@/core/entitlements/plan-recommendation";
export {
  addonFeatureForClinicPlugin,
  addonFeaturesForClinicPlugin,
} from "@/core/entitlements/plugin-features";
export {
  consumePatientCreateHeadroom,
  formatQuotaLabel,
  shouldAllowBulkPatientCreate,
  shouldAllowPatientCreate,
} from "@/core/entitlements/quota-display";
export {
  canUseFeatureWithCommercialStatus,
  canUseResolvedEntitlement,
  emptyEntitlements,
  getResolvedFeatureLimit,
  isOverrideActive,
  lookupFeature,
  parseLimitValue,
  resolveFeatureEntitlement,
  toClientEntitlementsSnapshot,
} from "@/core/entitlements/resolve";
export { isFeatureEntitledBySnapshot } from "@/core/entitlements/snapshot-access";
export { bytesToMb, decideStorageCapacity } from "@/core/entitlements/storage";
export { resolveTrustedClinicId } from "@/core/entitlements/trusted-clinic";
export {
  type ClientEntitlementsSnapshot,
  type EntitlementSource,
  type EntitlementSubscriptionStatus,
  type FeatureLimit,
  FeatureRequiredError,
  type ResolvedClinicEntitlements,
  type ResolvedFeatureEntitlement,
} from "@/core/entitlements/types";
export {
  AtomicUsageLedger,
  decideUsageConsume,
  decideUsageIncrement,
} from "@/core/entitlements/usage-consume";
export { featureUsagePeriodStart, isPositiveUsageAmount } from "@/core/entitlements/usage-period";
export {
  classifyUsageBand,
  DEFAULT_USAGE_THRESHOLDS,
  remainingUsage,
  type UsageBand,
  usagePercentage,
  type UsageThresholds,
} from "@/core/entitlements/usage-thresholds";
export { isVoiceInputEntitledBySnapshot } from "@/core/entitlements/voice-features";
