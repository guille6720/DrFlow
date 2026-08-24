import { LEGAL_CONTENT_VERSION } from "@/core/legal/content/types";

/** Versionado de documentos legales (incrementar al cambiar textos en /privacidad, /terminos, /aviso-paciente). */
export const LEGAL_PRIVACY_VERSION = LEGAL_CONTENT_VERSION;
export const LEGAL_TERMS_VERSION = LEGAL_CONTENT_VERSION;
export const LEGAL_PATIENT_NOTICE_VERSION = "2026-07-27";

export const CONSENT_TYPES = {
  patientDataProcessingBooking: "patient_data_processing_booking",
  clinicTermsSignup: "clinic_terms_signup",
  clinicPrivacySignup: "clinic_privacy_signup",
  prescriptionLocalDisclaimer: "prescription_local_disclaimer",
  informedConsentClinicalAct: "informed_consent_clinical_act",
} as const;

export type ConsentType = (typeof CONSENT_TYPES)[keyof typeof CONSENT_TYPES];

/** Conservación mínima recomendada para historias clínicas (Ley 26.529 / práctica habitual). */
export const CLINICAL_RECORD_RETENTION_YEARS = 10;
