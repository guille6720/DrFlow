export type PrescriptionType = "ambulatoria" | "cronica" | "duplicado";
export type PrescriptionStatus = "draft" | "issued" | "void";
export type RefepsStatus = "local" | "pending_refeps" | "submitted";

export interface PrescriptionMedication {
  generic_name: string;
  brand_name?: string;
  presentation?: string;
  concentration?: string;
  quantity: number;
  posology: string;
  route?: string;
  prolonged_treatment?: boolean;
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
  patient_insurance: string | null;
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

export const ARGENTINA_PRESCRIPTION_DISCLAIMER =
  "Receta generada en DrFlow según Ley 25.649 (prescripción por nombre genérico). " +
  "Para validez ante farmacias con trazabilidad REFEPS/RENaPDiS, la clínica debe completar " +
  "homologación con el Ministerio de Salud de la Nación y firma digital habilitante.";
