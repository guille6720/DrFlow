import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { mergePatientAuditEvents } from "@/core/security/audit-types";
import {
  APPOINTMENT_AGENDA_COLUMNS,
  CLINICAL_RECORD_EDIT_COLUMNS,
  MEDICAL_ORDER_LIST_COLUMNS,
  PATIENT_DETAIL_COLUMNS,
} from "@/core/supabase/select-columns";

export const HABEAS_DATA_EXPORT_VERSION = "1.0";

export const HABEAS_DATA_LEGAL_BASIS =
  "Exportación a pedido del responsable del tratamiento (consultorio) para ejercicio de derechos de acceso, rectificación, cancelación u oposición del titular — Ley 25.326 y Ley 26.529.";

const PRESCRIPTION_EXPORT_COLUMNS =
  "id, patient_id, professional_id, clinical_record_id, medications, notes, status, diagnosis_text, diagnosis_cie10, issued_at, prescription_number, prescription_type, validity_days, patient_insurance, coverage_kind, insurance_number, insurance_plan, dispensed_at, created_at, updated_at";

const PATIENT_AUDIT_EXPORT_LIMIT = 500;
const CLINIC_PATIENT_LIMIT = 5000;
const CLINIC_RECORDS_LIMIT = 5000;
const CLINIC_APPOINTMENTS_LIMIT = 10_000;
const CLINIC_PRESCRIPTIONS_LIMIT = 5000;
const CLINIC_ORDERS_LIMIT = 5000;

export type HabeasDataSectionCounts = {
  clinical_records: number;
  appointments: number;
  prescriptions: number;
  medical_orders: number;
  consent_records: number;
  attachments_metadata: number;
  cash_charges: number;
  payments: number;
  patient_ledger_entries: number;
  telemedicine_sessions: number;
  audit_trail: number;
};

export type PatientHabeasDataSections = {
  clinical_records: unknown[];
  appointments: unknown[];
  prescriptions: unknown[];
  prescription_events: unknown[];
  medical_orders: unknown[];
  consent_records: unknown[];
  attachments_metadata: unknown[];
  cash_charges: unknown[];
  payments: unknown[];
  patient_ledger_entries: unknown[];
  telemedicine_sessions: unknown[];
  audit_trail: ReturnType<typeof mergePatientAuditEvents>;
  warnings: string[];
};

async function queryOrEmpty<T>(
  label: string,
  run: () => PromiseLike<{ data: T | null; error: { message: string } | null }>,
  warnings: string[]
): Promise<T> {
  const { data, error } = await run();
  if (error) {
    warnings.push(`${label}: ${error.message}`);
    return [] as T;
  }
  return (data ?? []) as T;
}

export async function fetchPatientAuditTrailForExport(
  supabase: SupabaseClient,
  clinicId: string,
  patientId: string,
  warnings: string[]
) {
  const patientFilter = `patient_id.eq.${patientId},entity_id.eq.${patientId}`;

  const clinicLogs = await queryOrEmpty(
    "audit_logs",
    () =>
      supabase
        .from("audit_logs")
        .select(
          "id, action, module, what, entity_type, entity_id, created_at, ip_address, user_agent, old_values, new_values, profiles(full_name)"
        )
        .eq("clinic_id", clinicId)
        .or(patientFilter)
        .order("created_at", { ascending: false })
        .limit(PATIENT_AUDIT_EXPORT_LIMIT),
    warnings
  );

  const recordLogs = await queryOrEmpty(
    "clinical_record_audit",
    () =>
      supabase
        .from("clinical_record_audit")
        .select(
          "id, action, module, what, clinical_record_id, changed_at, ip_address, user_agent, old_values, new_values, profiles:changed_by(full_name)"
        )
        .eq("clinic_id", clinicId)
        .eq("patient_id", patientId)
        .order("changed_at", { ascending: false })
        .limit(PATIENT_AUDIT_EXPORT_LIMIT),
    warnings
  );

  return mergePatientAuditEvents(clinicLogs, recordLogs);
}

export async function fetchPatientHabeasDataSections(
  supabase: SupabaseClient,
  clinicId: string,
  patientId: string
): Promise<PatientHabeasDataSections> {
  const warnings: string[] = [];

  const [
    clinical_records,
    appointments,
    prescriptions,
    medical_orders,
    consent_records,
    attachments_metadata,
    cash_charges,
    payments,
    patient_ledger_entries,
  ] = await Promise.all([
    queryOrEmpty(
      "clinical_records",
      () =>
        supabase
          .from("clinical_records")
          .select(CLINICAL_RECORD_EDIT_COLUMNS)
          .eq("patient_id", patientId)
          .eq("clinic_id", clinicId)
          .order("created_at", { ascending: false }),
      warnings
    ),
    queryOrEmpty(
      "appointments",
      () =>
        supabase
          .from("appointments")
          .select(APPOINTMENT_AGENDA_COLUMNS)
          .eq("patient_id", patientId)
          .eq("clinic_id", clinicId)
          .order("start_at", { ascending: false }),
      warnings
    ),
    queryOrEmpty(
      "prescription_drafts",
      () =>
        supabase
          .from("prescription_drafts")
          .select(PRESCRIPTION_EXPORT_COLUMNS)
          .eq("patient_id", patientId)
          .eq("clinic_id", clinicId)
          .order("created_at", { ascending: false }),
      warnings
    ),
    queryOrEmpty(
      "medical_orders",
      () =>
        supabase
          .from("medical_orders")
          .select(MEDICAL_ORDER_LIST_COLUMNS)
          .eq("patient_id", patientId)
          .eq("clinic_id", clinicId)
          .order("created_at", { ascending: false }),
      warnings
    ),
    queryOrEmpty(
      "consent_records",
      () =>
        supabase
          .from("consent_records")
          .select(
            "consent_type, granted, granted_at, document_version, created_at, ip_address, clinical_record_id, procedure_description, signature_name, notes"
          )
          .eq("patient_id", patientId)
          .eq("clinic_id", clinicId)
          .order("created_at", { ascending: false }),
      warnings
    ),
    queryOrEmpty(
      "patient_attachments",
      () =>
        supabase
          .from("patient_attachments")
          .select("id, file_name, category, created_at, file_size, file_type, storage_path")
          .eq("patient_id", patientId)
          .eq("clinic_id", clinicId),
      warnings
    ),
    queryOrEmpty(
      "cash_charges",
      () =>
        supabase
          .from("cash_charges")
          .select(
            "id, appointment_id, professional_id, charge_kind, attention_type, payment_method, motive, amount, status, charged_at, voided_at, void_reason, notes, created_at"
          )
          .eq("patient_id", patientId)
          .eq("clinic_id", clinicId)
          .order("charged_at", { ascending: false }),
      warnings
    ),
    queryOrEmpty(
      "payments",
      () =>
        supabase
          .from("payments")
          .select(
            "id, appointment_id, amount, deposit_amount, status, external_reference, paid_at, created_at"
          )
          .eq("patient_id", patientId)
          .eq("clinic_id", clinicId)
          .order("created_at", { ascending: false }),
      warnings
    ),
    queryOrEmpty(
      "patient_ledger_entries",
      () =>
        supabase
          .from("patient_ledger_entries")
          .select("id, entry_at, concept, debit, credit, balance_after, notes, created_at")
          .eq("patient_id", patientId)
          .eq("clinic_id", clinicId)
          .order("entry_at", { ascending: false }),
      warnings
    ),
  ]);

  const appointmentIds = (appointments as Array<{ id: string }>).map((row) => row.id);
  const telemedicine_sessions =
    appointmentIds.length === 0
      ? []
      : await queryOrEmpty(
          "telemedicine_sessions",
          () =>
            supabase
              .from("telemedicine_sessions")
              .select("id, appointment_id, room_url, status, started_at, ended_at, created_at")
              .eq("clinic_id", clinicId)
              .in("appointment_id", appointmentIds),
          warnings
        );

  const prescriptionIds = (prescriptions as Array<{ id: string }>).map((row) => row.id);
  const prescription_events =
    prescriptionIds.length === 0
      ? []
      : await queryOrEmpty(
          "prescription_events",
          () =>
            supabase
              .from("prescription_events")
              .select("id, prescription_id, event_type, actor_id, payload, created_at")
              .eq("clinic_id", clinicId)
              .in("prescription_id", prescriptionIds)
              .order("created_at", { ascending: false }),
          warnings
        );

  const audit_trail = await fetchPatientAuditTrailForExport(
    supabase,
    clinicId,
    patientId,
    warnings
  );

  return {
    clinical_records,
    appointments,
    prescriptions,
    prescription_events,
    medical_orders,
    consent_records,
    attachments_metadata,
    cash_charges,
    payments,
    patient_ledger_entries,
    telemedicine_sessions,
    audit_trail,
    warnings,
  };
}

export function countHabeasSections(sections: PatientHabeasDataSections): HabeasDataSectionCounts {
  return {
    clinical_records: sections.clinical_records.length,
    appointments: sections.appointments.length,
    prescriptions: sections.prescriptions.length,
    medical_orders: sections.medical_orders.length,
    consent_records: sections.consent_records.length,
    attachments_metadata: sections.attachments_metadata.length,
    cash_charges: sections.cash_charges.length,
    payments: sections.payments.length,
    patient_ledger_entries: sections.patient_ledger_entries.length,
    telemedicine_sessions: sections.telemedicine_sessions.length,
    audit_trail: sections.audit_trail.length,
  };
}

export function buildPatientHabeasDataPayload(
  patient: Record<string, unknown>,
  sections: PatientHabeasDataSections,
  exportedAt: string
) {
  const { warnings, audit_trail, ...dataSections } = sections;

  return {
    export_version: HABEAS_DATA_EXPORT_VERSION,
    export_type: "patient_habeas_data",
    exported_at: exportedAt,
    legal_basis: HABEAS_DATA_LEGAL_BASIS,
    patient,
    ...dataSections,
    audit_trail,
    summary: countHabeasSections(sections),
    warnings: warnings.length ? warnings : undefined,
    notes: {
      attachments:
        "Metadatos de adjuntos incluidos. Los archivos binarios deben exportarse por separado desde Storage si el titular lo solicita.",
      prescriptions: "Recetas locales Ley 25.649 — no constituyen trazabilidad REFEPS/RENaPDiS.",
    },
  };
}

export type ClinicHabeasDataPayload = {
  export_version: string;
  export_type: "clinic_habeas_data";
  exported_at: string;
  legal_basis: string;
  clinic: Record<string, unknown> | null;
  patients: unknown[];
  clinical_records: unknown[];
  appointments: unknown[];
  prescriptions: unknown[];
  medical_orders: unknown[];
  consent_records: unknown[];
  attachments_metadata: unknown[];
  cash_charges: unknown[];
  payments: unknown[];
  summary: Record<string, number>;
  limits: Record<string, number>;
  warnings?: string[];
};

export async function fetchClinicHabeasDataPayload(
  supabase: SupabaseClient,
  clinicId: string
): Promise<ClinicHabeasDataPayload> {
  const warnings: string[] = [];
  const exportedAt = new Date().toISOString();

  const { data: clinic } = await supabase
    .from("clinics")
    .select(
      "id, name, slug, legal_name, phone, email, address, legal_terms_version, legal_terms_accepted_at, legal_privacy_version"
    )
    .eq("id", clinicId)
    .single();

  const [
    patients,
    clinical_records,
    appointments,
    prescriptions,
    medical_orders,
    consent_records,
    attachments_metadata,
    cash_charges,
    payments,
  ] = await Promise.all([
    queryOrEmpty("patients", () =>
      supabase
        .from("patients")
        .select(PATIENT_DETAIL_COLUMNS)
        .eq("clinic_id", clinicId)
        .order("last_name")
        .limit(CLINIC_PATIENT_LIMIT)
    , warnings),
    queryOrEmpty("clinical_records", () =>
      supabase
        .from("clinical_records")
        .select(CLINICAL_RECORD_EDIT_COLUMNS)
        .eq("clinic_id", clinicId)
        .order("created_at", { ascending: false })
        .limit(CLINIC_RECORDS_LIMIT)
    , warnings),
    queryOrEmpty("appointments", () =>
      supabase
        .from("appointments")
        .select(APPOINTMENT_AGENDA_COLUMNS)
        .eq("clinic_id", clinicId)
        .order("start_at", { ascending: false })
        .limit(CLINIC_APPOINTMENTS_LIMIT)
    , warnings),
    queryOrEmpty("prescription_drafts", () =>
      supabase
        .from("prescription_drafts")
        .select(PRESCRIPTION_EXPORT_COLUMNS)
        .eq("clinic_id", clinicId)
        .order("created_at", { ascending: false })
        .limit(CLINIC_PRESCRIPTIONS_LIMIT)
    , warnings),
    queryOrEmpty("medical_orders", () =>
      supabase
        .from("medical_orders")
        .select(MEDICAL_ORDER_LIST_COLUMNS)
        .eq("clinic_id", clinicId)
        .order("created_at", { ascending: false })
        .limit(CLINIC_ORDERS_LIMIT)
    , warnings),
    queryOrEmpty("consent_records", () =>
      supabase
        .from("consent_records")
        .select(
          "patient_id, consent_type, granted, granted_at, document_version, created_at, clinical_record_id, procedure_description, signature_name, notes"
        )
        .eq("clinic_id", clinicId)
        .order("created_at", { ascending: false })
        .limit(CLINIC_RECORDS_LIMIT)
    , warnings),
    queryOrEmpty("patient_attachments", () =>
      supabase
        .from("patient_attachments")
        .select("id, patient_id, file_name, category, created_at, file_size, file_type")
        .eq("clinic_id", clinicId)
        .limit(CLINIC_RECORDS_LIMIT)
    , warnings),
    queryOrEmpty("cash_charges", () =>
      supabase
        .from("cash_charges")
        .select(
          "id, patient_id, appointment_id, amount, status, charged_at, charge_kind, payment_method, motive"
        )
        .eq("clinic_id", clinicId)
        .order("charged_at", { ascending: false })
        .limit(CLINIC_RECORDS_LIMIT)
    , warnings),
    queryOrEmpty("payments", () =>
      supabase
        .from("payments")
        .select("id, patient_id, appointment_id, amount, status, paid_at, created_at")
        .eq("clinic_id", clinicId)
        .order("created_at", { ascending: false })
        .limit(CLINIC_RECORDS_LIMIT)
    , warnings),
  ]);

  return {
    export_version: HABEAS_DATA_EXPORT_VERSION,
    export_type: "clinic_habeas_data",
    exported_at: exportedAt,
    legal_basis: HABEAS_DATA_LEGAL_BASIS,
    clinic: clinic ?? null,
    patients,
    clinical_records,
    appointments,
    prescriptions,
    medical_orders,
    consent_records,
    attachments_metadata,
    cash_charges,
    payments,
    summary: {
      patients: patients.length,
      clinical_records: clinical_records.length,
      appointments: appointments.length,
      prescriptions: prescriptions.length,
      medical_orders: medical_orders.length,
      consent_records: consent_records.length,
      attachments_metadata: attachments_metadata.length,
      cash_charges: cash_charges.length,
      payments: payments.length,
    },
    limits: {
      patients: CLINIC_PATIENT_LIMIT,
      clinical_records: CLINIC_RECORDS_LIMIT,
      appointments: CLINIC_APPOINTMENTS_LIMIT,
      prescriptions: CLINIC_PRESCRIPTIONS_LIMIT,
      medical_orders: CLINIC_ORDERS_LIMIT,
    },
    warnings: warnings.length ? warnings : undefined,
  };
}
