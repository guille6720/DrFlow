import type {
  AppointmentStatus,
  ConsultationModality,
  PaymentStatus,
  UserRole,
} from "@/types/database";

/** Patient row for pickers (minimal columns). */
export type PatientPickerRow = {
  id: string;
  first_name: string;
  last_name: string;
  document_number?: string;
};

export type ConsultPatientPickerRow = PatientPickerRow & {
  allergies?: string | null;
  regular_medication?: string | null;
  medical_history?: string | null;
};

/** Nested PostgREST relation — may be object or single-element array. */
export type NestedRow<T extends Record<string, unknown>> = T | T[] | null;

/** Professional row for lists, planillas and nueva consulta. */
export type ProfessionalListRow = {
  id: string;
  display_name: string | null;
  license_number: string | null;
  license_national?: string | null;
  license_provincial?: string | null;
  signature_text?: string | null;
  signature_image_path?: string | null;
  signature_image_url?: string | null;
  profiles?: NestedRow<{ full_name: string }>;
};

/** Professional row loaded for agenda views. */
export type ProfessionalAgendaRow = {
  id: string;
  clinic_id: string;
  user_id: string | null;
  specialty_id: string | null;
  location_id: string | null;
  license_number: string | null;
  license_national?: string | null;
  license_provincial?: string | null;
  display_name: string | null;
  is_active: boolean;
  profiles?: NestedRow<{ full_name: string }>;
  specialties?: NestedRow<{ name: string }>;
};

/** Appointment row with agenda joins (matches APPOINTMENT_AGENDA_COLUMNS select). */
export type AppointmentAgendaRow = {
  id: string;
  clinic_id: string;
  patient_id: string;
  professional_id: string;
  location_id: string | null;
  specialty_id: string | null;
  start_at: string;
  end_at: string;
  status: AppointmentStatus;
  notes: string | null;
  booking_source?: "manual" | "online" | null;
  cancellation_reason: string | null;
  cancellation_category?: string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
  cancelled_by_type: "patient" | "clinic" | null;
  consultation_modality?: ConsultationModality | null;
  waiting_room_status?:
    | "waiting"
    | "confirmed"
    | "in_consultation"
    | "finished"
    | "cancelled"
    | "absent"
    | null;
  is_overbooking?: boolean | null;
  rescheduled_at?: string | null;
  patients?: NestedRow<{ first_name: string; last_name: string; document_number?: string; insurance_provider?: string | null; insurance_plan?: string | null }>;
  professionals?: NestedRow<{ profiles?: NestedRow<{ full_name?: string }> }>;
  locations?: NestedRow<{ name: string }>;
  specialties?: NestedRow<{ name: string }>;
};

/** Payment list row with optional patient join. */
export type PaymentListRow = {
  id: string;
  clinic_id: string;
  patient_id: string;
  amount: number;
  deposit_amount: number;
  status: PaymentStatus;
  created_at: string;
  paid_at?: string | null;
  patients?: NestedRow<{ first_name: string; last_name: string }>;
};

/** Settings panel professional row. */
export type SettingsProfessionalRow = {
  id: string;
  display_name: string | null;
  license_number: string | null;
  profiles?: NestedRow<{ full_name: string }>;
  specialties?: NestedRow<{ name: string }>;
};

/** Settings panel clinic member row. */
export type SettingsMemberRow = {
  id: string;
  role: UserRole | string;
  is_active?: boolean;
  profiles?: { full_name: string; email: string } | null;
};

/** Settings panel invitation row. */
export type SettingsInvitationRow = {
  id: string;
  email: string;
  full_name: string;
  role: UserRole | string;
  status: string;
  created_at: string;
  initial_password?: string | null;
};

/** Command palette patient search row. */
export type PatientSearchRow = {
  id: string;
  first_name: string;
  last_name: string;
  document_number: string;
};
