import { type FeatureKey, FEATURES } from "@/core/entitlements/features";

/**
 * Progressive commercial enforcement.
 * Core clinical workflows stay ungated forever.
 * If migration 121 is not applied, callers must fail open.
 *
 * Phase 29: existing production modules listed below keep infrastructure
 * (catalog, overrides, UI notices) but are NOT mandatorily blocked yet.
 * Enable those keys progressively after staging validation.
 */
export const ENTITLEMENT_ENFORCEMENT_ENABLED = true;

export const CORE_UNGATED_FEATURES = [
  FEATURES.DASHBOARD,
  FEATURES.PATIENTS,
  FEATURES.APPOINTMENTS,
  FEATURES.WAITING_ROOM,
  FEATURES.CLINICAL_HISTORY,
  FEATURES.CONSULTATIONS,
  FEATURES.MEDICAL_ORDERS,
  FEATURES.TEMPLATES,
  FEATURES.DOCUMENTS,
  FEATURES.PROFESSIONALS,
  FEATURES.NOTIFICATIONS,
  FEATURES.AUDIT,
  FEATURES.BASIC_REPORTS,
] as const satisfies readonly FeatureKey[];

/**
 * Existing modules that must not suddenly block live clinics.
 * Catalog + admin overrides remain; `isFeatureEnforced` stays false until
 * progressive enablement after staging validation.
 */
export const EXISTING_MODULE_ENFORCEMENT_DEFERRED = [
  FEATURES.PATIENTS,
  FEATURES.CLINICAL_HISTORY,
  FEATURES.APPOINTMENTS,
  FEATURES.MEDICAL_ORDERS,
  FEATURES.DOCUMENTS,
  FEATURES.BASIC_REPORTS,
  FEATURES.PAMI,
  FEATURES.ADVANCED_REPORTS,
] as const satisfies readonly FeatureKey[];

export const ADDON_GATED_FEATURES = [
  FEATURES.PAMI,
  FEATURES.INSURANCE,
  FEATURES.PDF_EXPORT,
  FEATURES.DATA_EXPORT,
  FEATURES.ADVANCED_REPORTS,
  FEATURES.WHATSAPP,
  FEATURES.WHATSAPP_REMINDERS,
  FEATURES.AUTOMATION,
  FEATURES.AUTOMATION_FOLLOW_UP,
  FEATURES.AI,
  FEATURES.AI_CLINICAL_SUMMARY,
  FEATURES.AI_DOCUMENT_GENERATION,
  FEATURES.AI_TRANSCRIPTION,
  FEATURES.INTEGRATIONS,
  FEATURES.API,
  FEATURES.BRANDING,
  FEATURES.TELEMEDICINE,
  FEATURES.PHARMACOLOGY,
  FEATURES.PORTAL,
  FEATURES.VOICE,
  FEATURES.CASH_REGISTER,
  FEATURES.AI_MONTHLY_REQUESTS,
  FEATURES.AI_MONTHLY_TRANSCRIPTIONS,
  FEATURES.WHATSAPP_MONTHLY_MESSAGES,
] as const satisfies readonly FeatureKey[];

/** Seat/entity caps. Creating new rows may be blocked; existing clinical data stays available. */
export const SEAT_LIMIT_FEATURES = [
  FEATURES.USERS_MAX,
  FEATURES.PROFESSIONALS_MAX,
  FEATURES.PATIENTS_MAX,
] as const satisfies readonly FeatureKey[];

const CORE_SET = new Set<string>(CORE_UNGATED_FEATURES);
const ADDON_SET = new Set<string>(ADDON_GATED_FEATURES);
const SEAT_SET = new Set<string>(SEAT_LIMIT_FEATURES);
const DEFERRED_SET = new Set<string>(EXISTING_MODULE_ENFORCEMENT_DEFERRED);

export function isEntitlementEnforcementEnabled(): boolean {
  return ENTITLEMENT_ENFORCEMENT_ENABLED;
}

export function isCoreUngatedFeature(featureKey: FeatureKey): boolean {
  return CORE_SET.has(featureKey);
}

export function isAddonGatedFeature(featureKey: FeatureKey): boolean {
  return ADDON_SET.has(featureKey);
}

export function isExistingModuleEnforcementDeferred(featureKey: FeatureKey): boolean {
  return DEFERRED_SET.has(featureKey);
}

/**
 * True only when progressive enforcement is active for this key.
 * Core clinical and phase-29 deferred existing modules never enforce.
 */
export function isFeatureEnforced(featureKey: FeatureKey): boolean {
  if (!ENTITLEMENT_ENFORCEMENT_ENABLED) return false;
  if (CORE_SET.has(featureKey)) return false;
  if (DEFERRED_SET.has(featureKey)) return false;
  return ADDON_SET.has(featureKey);
}

export function isSeatLimitEnforced(featureKey: FeatureKey): boolean {
  if (!ENTITLEMENT_ENFORCEMENT_ENABLED) return false;
  return SEAT_SET.has(featureKey);
}

export function isStorageLimitEnforced(): boolean {
  if (!ENTITLEMENT_ENFORCEMENT_ENABLED) return false;
  return true;
}

export function isAutomationLimitEnforced(): boolean {
  if (!ENTITLEMENT_ENFORCEMENT_ENABLED) return false;
  return true;
}
