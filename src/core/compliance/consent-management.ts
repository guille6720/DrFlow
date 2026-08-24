/**
 * Phase 11 — Consent management posture (versioned docs + required fields).
 * Does not constitute legal advice or AAIP certification.
 */

import {
  CONSENT_TYPES,
  type ConsentType,
  LEGAL_PATIENT_NOTICE_VERSION,
  LEGAL_PRIVACY_VERSION,
  LEGAL_TERMS_VERSION,
} from "@/core/legal/documents";
import { INFORMED_CONSENT_DOCUMENT_VERSION } from "@/core/legal/informed-consent";

export const CONSENT_SOURCES = [
  "public_booking",
  "clinical_ui",
  "clinic_signup",
  "rpc",
  "system",
] as const;

export type ConsentSource = (typeof CONSENT_SOURCES)[number];

export type ConsentDocumentDefinition = {
  consentType: ConsentType;
  /** Stable purpose key stored on consent_records.purpose */
  purpose: string;
  label: string;
  documentVersion: string;
  defaultSource: ConsentSource;
  /** patient_id required (false = clinic-level acceptance) */
  requiresPatient: boolean;
  allowsWithdrawal: boolean;
};

/** Versioned consent catalog — bump documentVersion when legal text changes. */
export const CONSENT_DOCUMENT_CATALOG: ConsentDocumentDefinition[] = [
  {
    consentType: CONSENT_TYPES.patientDataProcessingBooking,
    purpose: "patient_data_processing_public_booking",
    label: "Tratamiento de datos personales (turno web)",
    documentVersion: LEGAL_PATIENT_NOTICE_VERSION,
    defaultSource: "public_booking",
    requiresPatient: true,
    allowsWithdrawal: true,
  },
  {
    consentType: CONSENT_TYPES.informedConsentClinicalAct,
    purpose: "informed_consent_clinical_act",
    label: "Consentimiento informado (acto clínico)",
    documentVersion: INFORMED_CONSENT_DOCUMENT_VERSION,
    defaultSource: "clinical_ui",
    requiresPatient: true,
    allowsWithdrawal: true,
  },
  {
    consentType: CONSENT_TYPES.clinicTermsSignup,
    purpose: "clinic_terms_acceptance",
    label: "Términos y condiciones del consultorio",
    documentVersion: LEGAL_TERMS_VERSION,
    defaultSource: "clinic_signup",
    requiresPatient: false,
    allowsWithdrawal: false,
  },
  {
    consentType: CONSENT_TYPES.clinicPrivacySignup,
    purpose: "clinic_privacy_acceptance",
    label: "Política de privacidad del consultorio",
    documentVersion: LEGAL_PRIVACY_VERSION,
    defaultSource: "clinic_signup",
    requiresPatient: false,
    allowsWithdrawal: false,
  },
  {
    consentType: CONSENT_TYPES.prescriptionLocalDisclaimer,
    purpose: "prescription_local_disclaimer",
    label: "Aviso de receta / dispensa local",
    documentVersion: LEGAL_PRIVACY_VERSION,
    defaultSource: "clinical_ui",
    requiresPatient: true,
    allowsWithdrawal: false,
  },
];

/** Fields Phase 11 requires on consent evidence (where applicable). */
export const CONSENT_EVIDENCE_FIELDS = [
  "patient_id",
  "clinic_id",
  "purpose",
  "document_version",
  "created_at / granted_at",
  "source",
  "recorded_by",
  "withdrawn_at",
  "withdrawn_by / withdrawal_reason",
] as const;

export type ConsentLifecycleStatus = "granted" | "withdrawn" | "denied" | "unknown";

export function resolveConsentLifecycleStatus(row: {
  granted: boolean;
  withdrawn_at?: string | null;
}): ConsentLifecycleStatus {
  if (row.withdrawn_at) return "withdrawn";
  if (row.granted) return "granted";
  if (row.granted === false) return "denied";
  return "unknown";
}

export function getConsentDocumentDefinition(
  consentType: string
): ConsentDocumentDefinition | undefined {
  return CONSENT_DOCUMENT_CATALOG.find((d) => d.consentType === consentType);
}

export type ConsentManagementPosture = {
  appendOnlyHistory: true;
  withdrawalSupported: true;
  clinicSignupPersisted: true;
  versionedCatalog: true;
  documentCount: number;
  notes: string[];
};

export function evaluateConsentManagementPosture(): ConsentManagementPosture {
  return {
    appendOnlyHistory: true,
    withdrawalSupported: true,
    clinicSignupPersisted: true,
    versionedCatalog: true,
    documentCount: CONSENT_DOCUMENT_CATALOG.length,
    notes: [
      "consent_records es inmutable salvo retiro vía withdraw_patient_consent.",
      "No se sobrescribe historial: el grant original permanece con withdrawn_at.",
      "Alta de consultorio debe llamar record_clinic_legal_consent además de clinics.*_version.",
      "Versiones de documentos viven en CONSENT_DOCUMENT_CATALOG / core/legal.",
    ],
  };
}
