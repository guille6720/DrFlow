import { type FeatureKey, FEATURES } from "@/core/entitlements/features";
import { PLAN_KEYS, type PlanKey } from "@/core/entitlements/plan-keys";

export type EntitlementsAdminClinicRow = {
  clinicId: string;
  clinicName: string;
  planKey: string | null;
  status: string | null;
  trialEndsAt: string | null;
  usageAi: number | null;
  usageWhatsapp: number | null;
};

export type EntitlementsAdminOverrideRow = {
  clinicId: string;
  clinicName: string;
  featureKey: string;
  enabled: boolean;
  endsAt: string | null;
  reason: string | null;
};

export const ADMIN_ASSIGNABLE_PLAN_KEYS: PlanKey[] = [
  PLAN_KEYS.TRIAL,
  PLAN_KEYS.ESSENTIAL,
  PLAN_KEYS.BASIC,
  PLAN_KEYS.PRO,
  PLAN_KEYS.PREMIUM,
  PLAN_KEYS.ENTERPRISE,
  PLAN_KEYS.LEGACY,
];

export const ADMIN_OVERRIDE_FEATURE_KEYS: FeatureKey[] = [
  FEATURES.PAMI,
  FEATURES.INSURANCE,
  FEATURES.CASH_REGISTER,
  FEATURES.PHARMACOLOGY,
  FEATURES.PORTAL,
  FEATURES.PDF_EXPORT,
  FEATURES.DATA_EXPORT,
  FEATURES.ADVANCED_REPORTS,
  FEATURES.AI,
  FEATURES.AI_CLINICAL_SUMMARY,
  FEATURES.AI_DOCUMENT_GENERATION,
  FEATURES.AI_MONTHLY_REQUESTS,
  FEATURES.AI_MONTHLY_TRANSCRIPTIONS,
  FEATURES.AUTOMATION,
  FEATURES.AUTOMATION_FOLLOW_UP,
  FEATURES.AUTOMATIONS_MAX_ACTIVE,
  FEATURES.AI_TRANSCRIPTION,
  FEATURES.BRANDING,
  FEATURES.PATIENTS_MAX,
  FEATURES.PROFESSIONALS_MAX,
  FEATURES.STORAGE_MAX_MB,
  FEATURES.USERS_MAX,
  FEATURES.WHATSAPP,
  FEATURES.WHATSAPP_REMINDERS,
  FEATURES.WHATSAPP_MONTHLY_MESSAGES,
  FEATURES.TELEMEDICINE,
  FEATURES.VOICE,
  FEATURES.INTEGRATIONS,
  FEATURES.API,
];

export const ADMIN_SUBSCRIPTION_STATUS_KEYS = [
  "active",
  "trialing",
  "past_due",
  "cancelled",
  "expired",
] as const;
