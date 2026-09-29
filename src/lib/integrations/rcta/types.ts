/**
 * RCTA integration contracts.
 *
 * Phase 1 only opens the RCTA web app in a new tab. The payload/result types below are NexClinic-side
 * shapes prepared for a future official API; they are NOT RCTA request/response formats.
 * TODO: Implement official RCTA API once vendor documentation and credentials are available.
 */

export type RctaDocumentKind = "prescription" | "medical_order";

/** Launch surface used by the UI. `patientId` is only for NexClinic-side context; it never goes into the URL. */
export interface RctaIntegration {
  readonly mode: "external_link";
  openExternalPrescription(patientId: string): void;
  openExternalMedicalOrder(patientId: string): void;
}

/** Read-only patient data shown to the clinician to copy manually into RCTA. */
export type RctaPatientContext = {
  fullName: string;
  documentType: string | null;
  documentNumber: string | null;
  /** Display format, e.g. "12.345.678". */
  documentNumberFormatted: string | null;
  /** dd/mm/yyyy */
  birthDate: string | null;
  sex: string | null;
  insuranceProvider: string | null;
  insuranceNumber: string | null;
};

export type RctaAccess = {
  prescriptions: boolean;
  medicalOrders: boolean;
};

// ---------------------------------------------------------------------------
// Future API (server-side only). NexClinic-normalized shapes; vendor mapping will live in a provider adapter.
// ---------------------------------------------------------------------------

export type PatientPayload = {
  patientId: string;
  firstName: string;
  lastName: string;
  documentType: string | null;
  documentNumber: string | null;
  birthDate: string | null;
  sex: string | null;
  insuranceProvider: string | null;
  insuranceNumber: string | null;
};

export type ProfessionalPayload = {
  professionalId: string;
  fullName: string | null;
  licenseNumber: string | null;
  licenseJurisdiction: string | null;
  specialty: string | null;
  /** Professional identifier if the vendor requires one (e.g. REFEPS id). */
  externalIdentifier: string | null;
};

export type PrescriptionPayload = {
  patient: PatientPayload;
  professional: ProfessionalPayload;
  /**
   * TODO: Define once RCTA publishes its prescription contract. Do not invent fields.
   */
};

export type MedicalOrderPayload = {
  patient: PatientPayload;
  professional: ProfessionalPayload;
  /**
   * TODO: Define once RCTA publishes its order contract. Do not invent fields.
   */
};

export type RctaPrescriptionResult = {
  provider: "rcta";
  externalId: string;
  status: RctaDocumentStatus;
};

export type RctaMedicalOrderResult = {
  provider: "rcta";
  externalId: string;
  status: RctaDocumentStatus;
};

export type RctaDocumentStatus = "created" | "pending" | "cancelled" | "unknown";

/**
 * Future audit reference for documents created through RCTA (no table yet — phase 1 stores nothing).
 * Rows must be written server-side with clinic_id/professional_id resolved from the session.
 */
export type RctaDocumentReference = {
  provider: "rcta";
  externalId: string;
  patientId: string;
  professionalId: string;
  clinicId: string;
  documentType: RctaDocumentKind;
  createdAt: string;
  status: RctaDocumentStatus;
};
