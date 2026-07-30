/**
 * Manifest de tablas que deben tener RLS en migraciones DrFlow.
 * Actualizar al agregar tablas clínicas nuevas.
 */
export const TABLES_REQUIRING_RLS = [
  "clinics",
  "profiles",
  "clinic_members",
  "specialties",
  "locations",
  "professionals",
  "patients",
  "patient_attachments",
  "availability_rules",
  "schedule_blocks",
  "consultation_reasons",
  "appointments",
  "clinical_records",
  "clinical_record_attachments",
  "clinical_record_audit",
  "clinical_templates",
  "prescription_drafts",
  "reminder_logs",
  "telemedicine_sessions",
  "payments",
  "public_booking_links",
  "consent_records",
  "audit_logs",
  "pathologies",
  "drugs",
  "pathology_drugs",
  "symptoms",
  "pathology_symptoms",
  "medical_orders",
  "clinic_invitations",
  "patient_app_share_log",
  "cash_charge_types",
  "cash_payment_methods",
  "cash_charges",
  "patient_ledger_entries",
  "cash_invoices",
  "cash_daily_closures",
  "patient_admin_documents",
] as const;

/** RPC SECURITY DEFINER que deben acotar tenant (nombre → migración de referencia). */
export const SECURITY_DEFINER_RPC_CHECKS: { name: string; migrationHint: string }[] = [
  { name: "setup_user_clinic", migrationHint: "024" },
  { name: "seed_pami_cabecera_for_clinic", migrationHint: "030" },
  { name: "submit_public_booking", migrationHint: "010" },
  { name: "get_patient_appointment_statuses", migrationHint: "022" },
  { name: "seed_demo_patients_for_clinic", migrationHint: "019" },
];
