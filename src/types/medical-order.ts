export type MedicalOrderStatus = "draft" | "issued" | "void";

export interface MedicalOrder {
  id: string;
  clinic_id: string;
  patient_id: string;
  clinical_record_id: string | null;
  professional_id: string;
  order_text: string;
  notes: string | null;
  status: MedicalOrderStatus;
  issued_at: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}
