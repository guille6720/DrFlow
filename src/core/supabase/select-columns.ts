/** Shared PostgREST column lists — avoids SELECT * and keeps payloads small. */

export const PROFILE_COLUMNS =
  "id, email, full_name, phone, document_number, avatar_url, is_superadmin";

export const CLINIC_COLUMNS =
  "id, name, slug, legal_name, phone, email, address, default_appointment_duration, timezone, is_active, trial_ends_at, default_insurance_provider, practice_profile, legal_terms_version, legal_terms_accepted_at, legal_privacy_version, accepted_coverages, voice_input_enabled, doctors_can_access_cash, refeps_enabled, refeps_establishment_code, refeps_auto_submit";

/** Minimal clinic columns for membership fallback when full select fails (schema drift / PostgREST). */
export const CLINIC_SHELL_COLUMNS =
  "id, name, slug, timezone, is_active, trial_ends_at, voice_input_enabled, doctors_can_access_cash";

/** Guaranteed-safe subset for sidebar/header when shell columns fail. */
export const CLINIC_MINIMAL_COLUMNS = "id, name, slug, timezone, is_active, trial_ends_at";

export const PATIENT_LIST_COLUMNS =
  "id, first_name, last_name, document_number, document_type, cuil, alt_identifier_type, alt_identifier_value, birth_date, sex, insurance_provider, insurance_number, phone, email, address, allergies, regular_medication, emergency_contact_name, emergency_contact_phone, medical_history, insurance_plan, notes, clinic_id, created_at";

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
  "id, clinic_id, patient_id, professional_id, location_id, specialty_id, start_at, end_at, status, notes, booking_source, cancellation_reason, cancellation_category, cancelled_at, cancelled_by, cancelled_by_type, consultation_modality, waiting_room_status, waiting_room_entered_at, is_overbooking, rescheduled_at";

export const APPOINTMENT_REMINDER_COLUMNS =
  "id, clinic_id, patient_id, professional_id, start_at, status, notes";

export const APPOINTMENT_TELEMEDICINE_COLUMNS = "id, patient_id";

export const PROFESSIONAL_AGENDA_COLUMNS =
  "id, clinic_id, user_id, specialty_id, location_id, license_number, license_national, license_provincial, display_name, is_active";

export const PROFESSIONAL_PRESCRIBER_COLUMNS =
  "id, display_name, license_number, license_national, license_provincial, licensing_jurisdiction, refeps_identifier, signature_text, signature_image_path, profiles(full_name), specialties(name)";

export const CLINICAL_TEMPLATE_COLUMNS =
  "id, name, chief_complaint_template, diagnosis_template, evolution_template, indications_template";

export const CLINICAL_RECORD_EDIT_COLUMNS =
  "id, clinic_id, patient_id, appointment_id, professional_id, chief_complaint, diagnosis, evolution, indications, professional_signature, created_at, updated_at";

/** Minimal columns returned after direct insert fallback (legacy RPC drift). */
export const CLINICAL_RECORD_INSERT_RETURN_COLUMNS =
  "id, clinic_id, patient_id, appointment_id, professional_id, chief_complaint, diagnosis, evolution, indications, diagnosis_cie10, created_at, updated_at, record_version";

export const DATA_IMPORT_SESSION_COLUMNS =
  "id, clinic_id, created_by, import_type, original_filename, storage_path, status, column_mapping, date_format, template_id, headers, preview_rows, stats, duplicate_decisions, invalid_sample, duplicate_sample, error_summary, imported_count, skipped_count, failed_count, started_at, completed_at, created_at, updated_at";

export const CLINIC_SUBSCRIPTION_COLUMNS =
  "id, clinic_id, plan_id, status, billing_cycle, mercado_pago_payer_email, current_period_end, canceled_at, promo_started_at, promo_ends_at, promo_months, promo_price_amount, regular_price_amount, price_currency, created_at, updated_at";

export const PATIENT_ADMIN_DOCUMENT_RETURN_COLUMNS =
  "id, clinic_id, patient_id, category, title, file_name, file_path, file_size, uploaded_by, created_at";

export const PAYMENT_RETURN_COLUMNS =
  "id, clinic_id, patient_id, appointment_id, amount, deposit_amount, status, mock_transaction_id, paid_at, created_at";

export const CASH_CLOSURE_RETURN_COLUMNS =
  "id, clinic_id, closure_date, totals, patient_count, consultation_count, cash_difference, notes, closed_by, closed_at";

export const CASH_INVOICE_RETURN_COLUMNS =
  "id, clinic_id, cash_charge_id, patient_id, amount, status, notes, created_by, created_at";

export const MEDICAL_ORDER_LIST_COLUMNS =
  "id, clinic_id, patient_id, clinical_record_id, professional_id, order_text, order_type, notes, status, issued_at, created_at, updated_at, version";

export const MEDICAL_ORDER_IDEMPOTENCY_COLUMNS = `${MEDICAL_ORDER_LIST_COLUMNS}, idempotency_key, created_by`;

export const PRESCRIPTION_RECENT_LIST_COLUMNS =
  "id, patient_id, professional_id, created_at, medications, status, diagnosis_text, diagnosis_cie10, issued_at, prescription_number, prescription_type, validity_days, patient_insurance, notes, refeps_status, refeps_id, refeps_submitted_at, refeps_error, digital_signature_hash, national_rx_status, cuir_status, cuir_formatted";

export const PRESCRIPTION_LIST_COLUMNS =
  "id, created_at, medications, status, diagnosis_text, diagnosis_cie10, issued_at, prescription_number, prescription_type, validity_days, patient_insurance, coverage_kind, insurance_number, insurance_plan, dispensed_at, notes, professional_id, refeps_status, refeps_id, refeps_submitted_at, refeps_error, digital_signature_hash, national_rx_status, cuir_status, cuir_formatted";

export const PUBLIC_BOOKING_LINK_COLUMNS = "id, clinic_id, slug, is_active";

export const TELEMEDICINE_SESSION_LIST_COLUMNS =
  "id, clinic_id, appointment_id, room_url, status, provider, patient_join_url, expires_at, started_at, ended_at, created_at";
