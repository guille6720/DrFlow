import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { MEDICAL_ORDER_LIST_COLUMNS, PRESCRIPTION_LIST_COLUMNS } from "@/core/supabase/select-columns";

import {
  type ClinicalExportAttachment,
  type ClinicalExportConsultation,
  type ClinicalExportDiagnosis,
  type ClinicalExportMedication,
  type ClinicalExportOrder,
  type ClinicalExportPatient,
  type ClinicalExportPrescription,
  type ClinicalExportSnapshot,
} from "@/features/integraciones/lib/clinical-export-package";
import {
  type ClinicalExportDateRange,
  type ClinicalExportSection,
  inExportDateRange,
} from "@/features/integraciones/lib/clinical-export-sections";
import {
  attachStructuredChildrenToRecords,
  loadClinicalRecordChildrenForPatient,
} from "@/features/pacientes/server/load-clinical-structure";
import {
  fetchPatientClinicalRecordsForEhr,
  mapClinicalRecordsForEhr,
  PATIENT_EHR_PRINT_MAX_RECORDS,
} from "@/features/pacientes/server/load-patient-ehr-data";
import { loadPatientClinicalProfile } from "@/features/pacientes/server/patient-clinical-profile";

import { getCachedClinicProfessionalsList } from "@/lib/server/cached-clinic-queries";
import { getProfessionalDisplayName } from "@/lib/utils/professional";
import type { PrescriptionMedication } from "@/types/prescription";

export type PatientExportLoadContext = {
  /** When bulk-exporting, pass a shared map to avoid repeated clinic professional lookups. */
  professionalName?: Map<string, string>;
};

export type ExportAttachmentFile = {
  category: string | null;
  file_name: string;
  file_path: string;
  file_size: number;
};

export type PatientExportPackage = {
  snapshot: ClinicalExportSnapshot;
  files: ExportAttachmentFile[];
};

const ATTACHMENT_SELECT_FULL =
  "file_name, file_path, file_type, file_size, category, created_at, document_date, source";
const ATTACHMENT_SELECT_BASIC = "file_name, file_path, file_type, file_size, category, created_at";

function needsRecords(sections: Set<ClinicalExportSection>): boolean {
  return (
    sections.has("consultations") ||
    sections.has("diagnoses") ||
    sections.has("medications")
  );
}

function mapMedications(raw: unknown): ClinicalExportPrescription["medications"] {
  if (!Array.isArray(raw)) return [];
  return (raw as PrescriptionMedication[]).map((item) => ({
    generic_name: item.generic_name,
    brand_name: item.brand_name,
    presentation: item.presentation,
    quantity: item.quantity,
    posology: item.posology,
  }));
}

export async function loadPatientExportPackage(
  supabase: SupabaseClient,
  clinicId: string,
  patientId: string,
  sections: ClinicalExportSection[],
  range: ClinicalExportDateRange,
  context?: PatientExportLoadContext
): Promise<PatientExportPackage> {
  const include = new Set(sections);
  const warnings: string[] = [];
  const professionalName =
    context?.professionalName ??
    new Map(
      (await getCachedClinicProfessionalsList(clinicId)).map((row) => [
        row.id,
        getProfessionalDisplayName(row),
      ])
    );

  const { data: patientRow, error: patientError } = await supabase
    .from("patients")
    .select(
      "document_number, last_name, first_name, birth_date, phone, email, address, insurance_provider, insurance_plan, insurance_number, emergency_contact_name, emergency_contact_phone"
    )
    .eq("id", patientId)
    .eq("clinic_id", clinicId)
    .maybeSingle();

  if (patientError || !patientRow) {
    throw new Error("Paciente no encontrado.");
  }

  const patient = patientRow as ClinicalExportPatient;
  const profile = await loadPatientClinicalProfile(supabase, patientId, clinicId);

  const consultations: ClinicalExportConsultation[] = [];
  const diagnoses: ClinicalExportDiagnosis[] = [];
  const medications: ClinicalExportMedication[] = [];

  if (needsRecords(include)) {
    const { data: records, count, error } = await fetchPatientClinicalRecordsForEhr(
      supabase,
      clinicId,
      patientId,
      { limit: PATIENT_EHR_PRINT_MAX_RECORDS, withCount: true }
    );
    if (error) warnings.push("No se pudieron leer todas las consultas.");
    const mapped = mapClinicalRecordsForEhr(records);
    if ((count ?? mapped.length) > mapped.length) {
      warnings.push(`Se exportaron las últimas ${mapped.length} consultas (límite de seguridad).`);
    }
    const { diagnosesByRecord, treatmentsByRecord } = await loadClinicalRecordChildrenForPatient(
      supabase,
      clinicId,
      patientId,
      mapped.map((row) => row.id)
    );
    const withChildren = attachStructuredChildrenToRecords(
      mapped,
      diagnosesByRecord,
      treatmentsByRecord
    );

    let local = 1;
    for (const record of withChildren) {
      if (!inExportDateRange(record.created_at, range.from, range.to)) continue;
      if (include.has("consultations")) {
        consultations.push({
          local_key: `c${local}`,
          date: record.created_at,
          professional_name: record.professional_name,
          chief_complaint: record.chief_complaint ?? "",
          diagnosis: record.diagnosis ?? "",
          evolution: record.evolution ?? "",
          indications: record.indications ?? "",
        });
        local += 1;
      }
      if (include.has("diagnoses")) {
        const rows = record.diagnoses_rows ?? [];
        if (rows.length === 0 && record.diagnosis) {
          diagnoses.push({
            date: record.created_at,
            name: record.diagnosis,
            chronic: false,
            cie10: record.diagnosis_cie10 ?? null,
          });
        }
        for (const row of rows) {
          diagnoses.push({
            date: record.created_at,
            name: row.name,
            chronic: Boolean(row.is_chronic),
            cie10: row.cie10_code ?? null,
          });
        }
      }
      if (include.has("medications")) {
        for (const row of record.treatments_rows ?? []) {
          medications.push({
            date: record.created_at,
            product: row.product,
            dose: row.dose ?? "",
            frequency: row.frequency ?? "",
            notes: row.notes ?? "",
            status: row.status ?? "",
          });
        }
      }
    }
  }

  const prescriptions: ClinicalExportPrescription[] = [];
  if (include.has("prescriptions")) {
    const { data, error } = await supabase
      .from("prescription_drafts")
      .select(PRESCRIPTION_LIST_COLUMNS)
      .eq("clinic_id", clinicId)
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) warnings.push("No se pudieron leer las recetas.");
    for (const row of data ?? []) {
      const issued = row.issued_at ?? row.created_at;
      if (!inExportDateRange(issued, range.from, range.to)) continue;
      prescriptions.push({
        prescription_number: row.prescription_number,
        issued_at: issued,
        status: row.status,
        diagnosis_text: row.diagnosis_text,
        professional_name: professionalName.get(row.professional_id) ?? null,
        medications: mapMedications(row.medications),
      });
    }
  }

  const orders: ClinicalExportOrder[] = [];
  if (include.has("orders")) {
    const { data, error } = await supabase
      .from("medical_orders")
      .select(MEDICAL_ORDER_LIST_COLUMNS)
      .eq("clinic_id", clinicId)
      .eq("patient_id", patientId)
      .order("issued_at", { ascending: false })
      .limit(500);
    if (error) warnings.push("No se pudieron leer las órdenes.");
    for (const row of data ?? []) {
      if (!inExportDateRange(row.issued_at ?? row.created_at, range.from, range.to)) continue;
      orders.push({
        issued_at: row.issued_at,
        order_type: row.order_type ?? null,
        order_text: row.order_text,
        notes: row.notes,
        status: row.status,
        professional_name: professionalName.get(row.professional_id) ?? null,
      });
    }
  }

  const attachments: ClinicalExportAttachment[] = [];
  const files: ExportAttachmentFile[] = [];
  if (include.has("studies") || include.has("attachments")) {
    type AttachmentRow = {
      file_name: string;
      file_path: string;
      file_type: string | null;
      file_size: number | null;
      category: string | null;
      created_at: string;
      document_date?: string | null;
      source?: string | null;
    };
    let rows: AttachmentRow[] = [];
    const full = await supabase
      .from("patient_attachments")
      .select(ATTACHMENT_SELECT_FULL)
      .eq("clinic_id", clinicId)
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (full.error && /document_date|source/i.test(full.error.message)) {
      const basic = await supabase
        .from("patient_attachments")
        .select(ATTACHMENT_SELECT_BASIC)
        .eq("clinic_id", clinicId)
        .eq("patient_id", patientId)
        .order("created_at", { ascending: false })
        .limit(200);
      if (basic.error) warnings.push("No se pudieron leer los adjuntos.");
      rows = (basic.data ?? []) as AttachmentRow[];
    } else if (full.error) {
      warnings.push("No se pudieron leer los adjuntos.");
    } else {
      rows = (full.data ?? []) as AttachmentRow[];
    }
    for (const row of rows) {
      const dated = row.document_date ?? row.created_at;
      if (!inExportDateRange(dated, range.from, range.to)) continue;
      const isStudy = row.category === "estudio";
      if (isStudy && !include.has("studies")) continue;
      if (!isStudy && !include.has("attachments")) continue;
      attachments.push({
        file_name: row.file_name,
        category: row.category,
        created_at: row.created_at,
        document_date: row.document_date ?? null,
        source: row.source ?? null,
      });
      files.push({
        category: row.category,
        file_name: row.file_name,
        file_path: row.file_path,
        file_size: row.file_size ?? 0,
      });
    }
  }

  return {
    snapshot: {
      exported_at: new Date().toISOString(),
      patient,
      medical_history: profile?.medical_history ?? null,
      allergies: profile?.allergies ?? null,
      regular_medication: profile?.regular_medication ?? null,
      consultations,
      diagnoses,
      medications,
      prescriptions,
      orders,
      attachments,
      warnings,
    },
    files,
  };
}
