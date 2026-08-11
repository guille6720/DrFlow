export type PrescriptionType = "ambulatoria" | "cronica" | "duplicado";
export type PrescriptionStatus = "draft" | "issued" | "void";
export type RefepsStatus = "local" | "pending_refeps" | "submitted" | "failed";
export type PrescriptionCoverageKind = "PAMI" | "OBRAS_SOCIALES" | "PREPAGAS" | "PARTICULAR";

export interface PrescriptionMedication {
  generic_name: string;
  brand_name?: string;
  presentation?: string;
  concentration?: string;
  quantity: number;
  posology: string;
  route?: string;
  prolonged_treatment?: boolean;
  /** Extended fields (optional, backward compatible) */
  active_ingredient?: string;
  pharmaceutical_form?: string;
  dose?: string;
  frequency?: string;
  duration_days?: number;
  instructions?: string;
  vademecum_code?: string;
  search_source?: "pami" | "generic" | "manual";
}

export interface ElectronicPrescription {
  id: string;
  clinic_id: string;
  patient_id: string;
  clinical_record_id: string | null;
  professional_id: string;
  medications: PrescriptionMedication[];
  notes: string | null;
  disclaimer_accepted: boolean;
  prescription_type: PrescriptionType;
  diagnosis_cie10: string | null;
  diagnosis_text: string | null;
  status: PrescriptionStatus;
  prescription_number: string | null;
  issued_at: string | null;
  validity_days: number;
  refeps_status: RefepsStatus;
  refeps_id: string | null;
  refeps_submitted_at?: string | null;
  refeps_error?: string | null;
  refeps_payload?: Record<string, unknown> | null;
  digital_signature_hash?: string | null;
  patient_insurance: string | null;
  coverage_kind: PrescriptionCoverageKind | null;
  insurance_number: string | null;
  insurance_plan: string | null;
  idempotency_key: string | null;
  dispensed_at: string | null;
  version: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export const PRESCRIPTION_TYPE_LABELS: Record<PrescriptionType, string> = {
  ambulatoria: "Ambulatoria",
  cronica: "Crónica / prolongada",
  duplicado: "Duplicado (psicotrópicos)",
};

export const PRESCRIPTION_STATUS_LABELS: Record<PrescriptionStatus, string> = {
  draft: "Borrador",
  issued: "Emitida",
  void: "Anulada",
};

/** UI alias for cancelled prescriptions */
export const PRESCRIPTION_STATUS_UI_ALIASES: Partial<Record<PrescriptionStatus, string>> = {
  void: "Cancelada",
};

export function resolvePrescriptionDisplayStatus(row: Pick<ElectronicPrescription, "status" | "dispensed_at">): string {
  if (row.status === "issued" && row.dispensed_at) return "Dispensada";
  if (row.status === "void") return PRESCRIPTION_STATUS_UI_ALIASES.void ?? PRESCRIPTION_STATUS_LABELS.void;
  return PRESCRIPTION_STATUS_LABELS[row.status];
}

export const REFEPS_STATUS_LABELS: Record<RefepsStatus, string> = {
  local: "Local (sin REFEPS)",
  pending_refeps: "Pendiente REFEPS",
  submitted: "Registrada REFEPS",
  failed: "Error REFEPS",
};

export const ARGENTINA_PRESCRIPTION_DISCLAIMER =
  "Receta local / borrador — no es homologación REFEPS. " +
  "Generada en DrFlow según Ley 25.649 (prescripción por nombre genérico). " +
  "Para validez ante farmacias con trazabilidad REFEPS/RENaPDiS, la clínica debe completar " +
  "homologación con el Ministerio de Salud de la Nación y firma digital habilitante.";
