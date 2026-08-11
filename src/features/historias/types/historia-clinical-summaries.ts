import type { MedicalOrder } from "@/types/medical-order";
import type {
  PrescriptionCoverageKind,
  PrescriptionMedication,
  PrescriptionStatus,
  PrescriptionType,
  RefepsStatus,
} from "@/types/prescription";

/** Prescription row loaded on historia detail (partial select). */
export type HistoriaPrescriptionSummary = {
  id: string;
  created_at: string;
  medications: PrescriptionMedication[];
  status: PrescriptionStatus;
  diagnosis_text: string | null;
  issued_at: string | null;
  prescription_number: string | null;
  professional_id?: string;
  diagnosis_cie10?: string | null;
  prescription_type?: PrescriptionType;
  validity_days?: number;
  patient_insurance?: string | null;
  coverage_kind?: PrescriptionCoverageKind | null;
  insurance_number?: string | null;
  insurance_plan?: string | null;
  dispensed_at?: string | null;
  notes?: string | null;
  refeps_status?: RefepsStatus;
  refeps_id?: string | null;
  refeps_submitted_at?: string | null;
  refeps_error?: string | null;
  digital_signature_hash?: string | null;
};

/** Medical order row loaded on historia detail (partial select). */
export type HistoriaMedicalOrderSummary = Pick<
  MedicalOrder,
  | "id"
  | "order_text"
  | "notes"
  | "status"
  | "issued_at"
  | "created_at"
  | "updated_at"
  | "version"
  | "professional_id"
  | "patient_id"
  | "clinical_record_id"
> & {
  order_type?: string;
};
