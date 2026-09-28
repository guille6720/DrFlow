import type {
  ImagingContrast,
  MedicalOrderCategory,
  MedicalOrderPriority,
  MedicalOrderStatusV2,
} from "@/features/ordenes-medicas/constants";

export type MedicalOrderPatientSnapshot = {
  first_name?: string | null;
  last_name?: string | null;
  document_type?: string | null;
  document_number?: string | null;
  birth_date?: string | null;
  sex?: string | null;
  insurance_provider?: string | null;
  insurance_plan?: string | null;
  insurance_number?: string | null;
};

export type MedicalOrderIssuerSnapshot = {
  mechanism?: string;
  professional_id?: string;
  issued_by_user_id?: string | null;
  full_name?: string | null;
  specialty?: string | null;
  license_number?: string | null;
  license_national?: string | null;
  license_provincial?: string | null;
  licensing_jurisdiction?: string | null;
  clinic_id?: string;
  clinic_name?: string | null;
  clinic_address?: string | null;
  clinic_phone?: string | null;
  clinic_email?: string | null;
  issued_at?: string;
};

export type ImagingItemMetadata = {
  body_region?: string;
  contrast?: ImagingContrast;
  indication?: string;
  observations?: string;
};

export type MedicalOrderItem = {
  id?: string;
  category: MedicalOrderCategory;
  code: string | null;
  name: string;
  description: string | null;
  metadata: Record<string, unknown>;
  sort_order: number;
};

export type MedicalOrderListRow = {
  id: string;
  patient_id: string;
  professional_id: string;
  clinical_record_id: string | null;
  status: MedicalOrderStatusV2;
  order_text: string;
  order_type: string;
  order_category: MedicalOrderCategory | null;
  order_number: string | null;
  priority: MedicalOrderPriority | null;
  valid_until: string | null;
  issued_at: string | null;
  created_at: string;
  voided_at: string | null;
  void_reason: string | null;
  diagnosis_text: string | null;
  patient_name: string | null;
  patient_document: string | null;
  professional_name: string | null;
  /** false for rows created before the v2 module (no number / QR). */
  isV2: boolean;
};

export type MedicalOrderDetail = MedicalOrderListRow & {
  notes: string | null;
  diagnosis_code: string | null;
  clinical_indication: string | null;
  preparation_instructions: string | null;
  public_verification_token: string | null;
  document_hash: string | null;
  patient_snapshot: MedicalOrderPatientSnapshot | null;
  issuer_snapshot: MedicalOrderIssuerSnapshot | null;
  voided_by: string | null;
  items: MedicalOrderItem[];
};

export type MedicalOrderFilters = {
  patientId?: string;
  professionalId?: string;
  category?: MedicalOrderCategory;
  status?: MedicalOrderStatusV2;
  from?: string;
  to?: string;
  q?: string;
  limit?: number;
};

export type MedicalOrderCatalogEntry = {
  id: string;
  order_category: MedicalOrderCategory;
  group_label: string | null;
  code: string | null;
  name: string;
  /** Determinations included in a panel (e.g. hepatograma); prefilled as the item detail. */
  detail: string | null;
};

export type MedicalOrderVerification =
  | { found: false }
  | {
      found: true;
      order_number: string;
      status: "valida" | "anulada";
      expired: boolean;
      order_category: MedicalOrderCategory | null;
      items_count: number;
      patient_initials: string | null;
      patient_document_masked: string | null;
      professional_name: string | null;
      professional_license: string | null;
      issued_at: string | null;
      valid_until: string | null;
      voided_at: string | null;
      clinic_name: string | null;
    };
