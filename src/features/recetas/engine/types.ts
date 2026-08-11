import type { PrescriptionMedication, PrescriptionStatus, PrescriptionType } from "@/types/prescription";

export const COVERAGE_KINDS = ["PAMI", "OBRAS_SOCIALES", "PREPAGAS", "PARTICULAR"] as const;
export type CoverageKind = (typeof COVERAGE_KINDS)[number];

export type MedicationSearchSource = "pami_vademecum" | "pharmacology" | "manual";

export type CoverageRuleConfig = {
  /** Field keys required before issue */
  requiredFields: string[];
  /** Default validity days */
  maxValidityDays?: number;
  /** Preferred medication search provider */
  medicationSearch: MedicationSearchSource;
  /** Non-blocking messages shown at review */
  infoMessages?: string[];
};

export type PrescriptionDraftInput = {
  patient_id: string;
  clinical_record_id?: string | null;
  professional_id: string;
  prescription_type: PrescriptionType;
  diagnosis_cie10: string;
  diagnosis_text: string;
  patient_insurance?: string | null;
  coverage_kind?: CoverageKind | null;
  insurance_number?: string | null;
  insurance_plan?: string | null;
  medications: PrescriptionMedication[];
  notes?: string | null;
  validity_days: number;
  disclaimer_accepted: boolean;
};

export type PrescriptionPatientContext = {
  id: string;
  insurance_provider?: string | null;
  insurance_number?: string | null;
  insurance_plan?: string | null;
  document_number?: string | null;
};

export type PrescriptionProfessionalContext = {
  id: string;
  license_national?: string | null;
  license_provincial?: string | null;
  specialty_name?: string | null;
};

export type PrescriptionContext = {
  clinicId: string;
  patient: PrescriptionPatientContext;
  professional: PrescriptionProfessionalContext;
  coverageKind: CoverageKind;
  patientInsurance: string | null;
  rules: CoverageRuleConfig;
};

export type ValidationSeverity = "error" | "warning";

export type ValidationIssue = {
  severity: ValidationSeverity;
  code: string;
  message: string;
  field?: string;
};

export type ValidationResult = {
  valid: boolean;
  issues: ValidationIssue[];
};

export type PrescriptionEngineRow = PrescriptionDraftInput & {
  id?: string;
  status?: PrescriptionStatus;
  prescription_number?: string | null;
};

export type PrescriptionEventType =
  | "created"
  | "updated"
  | "validated"
  | "issued"
  | "voided"
  | "dispensed"
  | "template_applied";
