import { type FeatureKey, FEATURES, isFeatureKey } from "@/core/entitlements/features";

const COMMERCIAL_FEATURE_LABELS: Partial<Record<FeatureKey, string>> = {
  [FEATURES.PAMI]: "PAMI",
  [FEATURES.INSURANCE]: "Liquidación obras sociales",
  [FEATURES.CASH_REGISTER]: "Caja y cobranzas",
  [FEATURES.PHARMACOLOGY]: "Farmacología",
  [FEATURES.PORTAL]: "Reserva online y portal paciente",
  [FEATURES.PDF_EXPORT]: "Exportación PDF comercial",
  [FEATURES.DATA_EXPORT]: "Exportación de datos",
  [FEATURES.ADVANCED_REPORTS]: "Reportes avanzados",
  [FEATURES.WHATSAPP]: "WhatsApp",
  [FEATURES.WHATSAPP_REMINDERS]: "Recordatorios WhatsApp",
  [FEATURES.AUTOMATION]: "Automatizaciones",
  [FEATURES.AUTOMATION_FOLLOW_UP]: "Seguimiento proactivo",
  [FEATURES.AI]: "Inteligencia artificial",
  [FEATURES.AI_CLINICAL_SUMMARY]: "Resúmenes clínicos IA",
  [FEATURES.AI_DOCUMENT_GENERATION]: "Documentación IA",
  [FEATURES.AI_TRANSCRIPTION]: "Transcripción IA",
  [FEATURES.INTEGRATIONS]: "Integraciones FHIR",
  [FEATURES.API]: "API pública",
  [FEATURES.BRANDING]: "Branding personalizado",
  [FEATURES.TELEMEDICINE]: "Telemedicina",
  [FEATURES.VOICE]: "Dictado por voz",
  [FEATURES.USERS_MAX]: "Usuarios",
  [FEATURES.PROFESSIONALS_MAX]: "Profesionales",
  [FEATURES.PATIENTS_MAX]: "Pacientes",
  [FEATURES.STORAGE_MAX_MB]: "Almacenamiento",
  [FEATURES.AI_MONTHLY_REQUESTS]: "IA (mes)",
  [FEATURES.AI_MONTHLY_TRANSCRIPTIONS]: "Transcripciones (mes)",
  [FEATURES.WHATSAPP_MONTHLY_MESSAGES]: "WhatsApp (mes)",
  [FEATURES.AUTOMATIONS_MAX_ACTIVE]: "Automatizaciones activas",
};

export function commercialFeatureLabel(featureKey: string): string {
  if (isFeatureKey(featureKey)) {
    return COMMERCIAL_FEATURE_LABELS[featureKey] ?? featureKey;
  }
  return featureKey;
}
