/** Shared PostgREST column lists — avoids SELECT * and keeps payloads small. */

export const PROFILE_COLUMNS =
  "id, email, full_name, phone, document_number, avatar_url, is_superadmin";

export const CLINIC_COLUMNS =
  "id, name, slug, legal_name, phone, email, address, default_appointment_duration, timezone, is_active, trial_ends_at, default_insurance_provider, practice_profile, legal_terms_version, legal_terms_accepted_at, legal_privacy_version, accepted_coverages, voice_input_enabled, doctors_can_access_cash";

/** Minimal clinic columns for membership fallback when full select fails (schema drift / PostgREST). */
export const CLINIC_SHELL_COLUMNS =
  "id, name, slug, timezone, is_active, trial_ends_at, voice_input_enabled, doctors_can_access_cash";

/** Guaranteed-safe subset for sidebar/header when shell columns fail. */
export const CLINIC_MINIMAL_COLUMNS = "id, name, slug, timezone, is_active, trial_ends_at";

export const PATIENT_LIST_COLUMNS =
  "id, first_name, last_name, document_number, birth_date, insurance_provider, insurance_number, phone, email, address, allergies, regular_medication, emergency_contact_name, emergency_contact_phone, medical_history, insurance_plan, notes, clinic_id, created_at";

/** Workspace, edit form, and compliance export. */
export const PATIENT_DETAIL_COLUMNS = `${PATIENT_LIST_COLUMNS}, is_active`;

/** Admin-only patient panels (no clinical narrative fields). */
export const PATIENT_ADMIN_COLUMNS =
  "id, first_name, last_name, document_number, phone, email, address, insurance_provider, insurance_number, emergency_contact_name, emergency_contact_phone";

/** Clinical edit context (consulta form + PAMI banner). */
export const PATIENT_CLINICAL_CONTEXT_COLUMNS =
  "id, first_name, last_name, birth_date, insurance_provider, insurance_number, allergies, regular_medication, medical_history, emergency_contact_name, emergency_contact_phone";

export const PATIENT_PICKER_COLUMNS = "id, first_name, last_name";

export const APPOINTMENT_AGENDA_COLUMNS =
  "id, clinic_id, patient_id, professional_id, location_id, specialty_id, start_at, end_at, status, notes, booking_source, cancellation_reason, cancellation_category, cancelled_at, cancelled_by, cancelled_by_type, consultation_modality, waiting_room_status, is_overbooking, rescheduled_at";

export const APPOINTMENT_REMINDER_COLUMNS =
  "id, clinic_id, patient_id, professional_id, start_at, status, notes";

export const APPOINTMENT_TELEMEDICINE_COLUMNS = "id, patient_id";

export const PROFESSIONAL_AGENDA_COLUMNS =
  "id, clinic_id, user_id, specialty_id, location_id, license_number, license_national, license_provincial, display_name, is_active";

export const PROFESSIONAL_PRESCRIBER_COLUMNS =
  "id, display_name, license_number, license_national, license_provincial, signature_text, signature_image_path, profiles(full_name), specialties(name)";

export const CLINICAL_TEMPLATE_COLUMNS =
  "id, name, chief_complaint_template, diagnosis_template, evolution_template, indications_template";

export const CLINICAL_RECORD_EDIT_COLUMNS =
  "id, clinic_id, patient_id, appointment_id, professional_id, chief_complaint, diagnosis, evolution, indications, professional_signature, created_at, updated_at";

export const MEDICAL_ORDER_LIST_COLUMNS =
  "id, clinic_id, patient_id, clinical_record_id, professional_id, order_text, order_type, notes, status, issued_at, created_at, updated_at, version";

export const MEDICAL_ORDER_IDEMPOTENCY_COLUMNS = `${MEDICAL_ORDER_LIST_COLUMNS}, idempotency_key, created_by`;

export const PRESCRIPTION_RECENT_LIST_COLUMNS =
  "id, patient_id, professional_id, created_at, medications, status, diagnosis_text, diagnosis_cie10, issued_at, prescription_number, prescription_type, validity_days, patient_insurance, notes";

export const PUBLIC_BOOKING_LINK_COLUMNS = "id, clinic_id, slug, is_active";

export const TELEMEDICINE_SESSION_LIST_COLUMNS =
  "id, clinic_id, appointment_id, room_url, status, started_at, ended_at, created_at";
