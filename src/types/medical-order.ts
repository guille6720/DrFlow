export type MedicalOrderStatus = "draft" | "issued" | "void";

export interface MedicalOrder {
  id: string;
  clinic_id: string;
  patient_id: string;
  clinical_record_id: string | null;
  professional_id: string;
  order_text: string;
  order_type?: string;
  notes: string | null;
  status: MedicalOrderStatus;
  issued_at: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  /** Optimistic lock token — incrementa en cada mutación. */
  version: number;
}

/** Subset loaded in lists and used by the edit form (no clinic_id / created_by). */
export type MedicalOrderEditFields = Pick<
  MedicalOrder,
  "id" | "order_text" | "notes" | "version" | "professional_id"
> & {
  order_type?: string;
  clinical_record_id?: string | null;
};
