/** Shared PostgREST column lists — avoids SELECT * and keeps payloads small. */

export const PROFILE_COLUMNS =
  "id, email, full_name, phone, document_number, avatar_url, is_superadmin";

export const CLINIC_COLUMNS =
  "id, name, slug, legal_name, phone, email, address, default_appointment_duration, timezone, is_active, trial_ends_at, default_insurance_provider, practice_profile, legal_terms_version, legal_terms_accepted_at, legal_privacy_version, accepted_coverages, voice_input_enabled";

export const PATIENT_LIST_COLUMNS =
  "id, first_name, last_name, document_number, birth_date, insurance_provider, insurance_number, phone, email, address, allergies, regular_medication, emergency_contact_name, emergency_contact_phone, medical_history, insurance_plan, notes, clinic_id, created_at";

export const PATIENT_PICKER_COLUMNS = "id, first_name, last_name";

export const APPOINTMENT_AGENDA_COLUMNS =
  "id, clinic_id, patient_id, professional_id, location_id, specialty_id, start_at, end_at, status, notes, booking_source, cancellation_reason, cancellation_category, cancelled_at, cancelled_by, cancelled_by_type, consultation_modality, waiting_room_status, is_overbooking, rescheduled_at";

export const PROFESSIONAL_AGENDA_COLUMNS =
  "id, clinic_id, user_id, specialty_id, location_id, license_number, license_national, license_provincial, display_name, is_active";

export const CLINICAL_TEMPLATE_COLUMNS =
  "id, name, chief_complaint_template, diagnosis_template, evolution_template, indications_template";
