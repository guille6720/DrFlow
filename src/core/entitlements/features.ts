/** Commercial feature keys — never use raw strings at call sites. */
export const FEATURES = {
  DASHBOARD: "core.dashboard",
  PATIENTS: "patients.enabled",
  APPOINTMENTS: "appointments.enabled",
  WAITING_ROOM: "waiting_room.enabled",
  CLINICAL_HISTORY: "clinical_history.enabled",
  CONSULTATIONS: "consultations.enabled",
  MEDICAL_ORDERS: "medical_orders.enabled",
  TEMPLATES: "templates.enabled",
  DOCUMENTS: "documents.enabled",
  PDF_EXPORT: "pdf_export.enabled",
  DATA_EXPORT: "data_export.enabled",
  PAMI: "pami.enabled",
  INSURANCE: "insurance.enabled",
  BASIC_REPORTS: "reports.basic",
  ADVANCED_REPORTS: "reports.advanced",
  AUDIT: "audit.enabled",
  WHATSAPP: "whatsapp.enabled",
  WHATSAPP_REMINDERS: "whatsapp.reminders",
  NOTIFICATIONS: "notifications.enabled",
  AUTOMATION: "automation.enabled",
  AUTOMATION_FOLLOW_UP: "automation.follow_up",
  AI: "ai.enabled",
  AI_CLINICAL_SUMMARY: "ai.clinical_summary",
  AI_DOCUMENT_GENERATION: "ai.document_generation",
  AI_TRANSCRIPTION: "ai.transcription",
  INTEGRATIONS: "integrations.enabled",
  API: "api.enabled",
  BRANDING: "branding.custom",
  TELEMEDICINE: "telemedicine.enabled",
  PHARMACOLOGY: "pharmacology.enabled",
  PORTAL: "portal.enabled",
  VOICE: "voice.enabled",
  CASH_REGISTER: "cash_register.enabled",
  PROFESSIONALS: "professionals.enabled",
  USERS_MAX: "users.max",
  PROFESSIONALS_MAX: "professionals.max",
  PATIENTS_MAX: "patients.max",
  AI_MONTHLY_REQUESTS: "ai.monthly_requests",
  AI_MONTHLY_TRANSCRIPTIONS: "ai.monthly_transcriptions",
  WHATSAPP_MONTHLY_MESSAGES: "whatsapp.monthly_messages",
  AUTOMATIONS_MAX_ACTIVE: "automations.max_active",
  STORAGE_MAX_MB: "storage.max_mb",
} as const;

export type FeatureKey = (typeof FEATURES)[keyof typeof FEATURES];

const FEATURE_KEY_SET = new Set<string>(Object.values(FEATURES));

export function isFeatureKey(value: string): value is FeatureKey {
  return FEATURE_KEY_SET.has(value);
}

export const LIMIT_FEATURES = [
  FEATURES.USERS_MAX,
  FEATURES.PROFESSIONALS_MAX,
  FEATURES.PATIENTS_MAX,
  FEATURES.AI_MONTHLY_REQUESTS,
  FEATURES.AI_MONTHLY_TRANSCRIPTIONS,
  FEATURES.WHATSAPP_MONTHLY_MESSAGES,
  FEATURES.AUTOMATIONS_MAX_ACTIVE,
  FEATURES.STORAGE_MAX_MB,
] as const satisfies readonly FeatureKey[];

export const METERED_FEATURES = [
  FEATURES.AI_MONTHLY_REQUESTS,
  FEATURES.AI_MONTHLY_TRANSCRIPTIONS,
  FEATURES.WHATSAPP_MONTHLY_MESSAGES,
  FEATURES.STORAGE_MAX_MB,
] as const satisfies readonly FeatureKey[];

export function isLimitFeature(key: FeatureKey): boolean {
  return (LIMIT_FEATURES as readonly string[]).includes(key);
}

export function isMeteredFeature(key: FeatureKey): boolean {
  return (METERED_FEATURES as readonly string[]).includes(key);
}
