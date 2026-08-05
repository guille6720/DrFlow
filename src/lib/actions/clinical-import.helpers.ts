import type { SupabaseClient } from "@supabase/supabase-js";

import { validateCsvImportUpload } from "@/core/security/file-upload";
import { sanitizeText } from "@/core/validations/schemas";

import { CLINICAL_CSV_MAX_BYTES } from "@/lib/constants/clinical-documents";
import type { ClinicalCsvRow } from "@/lib/utils/clinical-csv-parse";
import {
  findOrCreatePatientFromExtract,
  resolveImportProfessionalId,
} from "@/lib/utils/clinical-pdf-import";
import type { ExtractedPatientInfo } from "@/lib/utils/pdf-patient-extract";

type CsvImportFailure = { success: false; fileName: string; error: string };

const EXCEL_MISPLACED_ERROR =
  "Este archivo Excel es el export de pacientes (consumers). No va acá: andá a Pacientes → Importar pacientes (Excel).";

const INVALID_CSV_ERROR = "Archivo CSV inválido o mayor a 8 MB. Usá extensión .csv";

function isExcelFileName(name: string): boolean {
  const lower = name.toLowerCase();
  return lower.endsWith(".xlsx") || lower.endsWith(".xls") || lower.endsWith(".csv.xlsx");
}

export function csvUploadError(
  fileName: string,
  isExcel: boolean
): CsvImportFailure {
  return {
    success: false,
    fileName,
    error: isExcel ? EXCEL_MISPLACED_ERROR : INVALID_CSV_ERROR,
  };
}

export function validateClinicalCsvFile(
  file: unknown,
  originalName: string,
  buffer: Buffer
): CsvImportFailure | null {
  if (!(file instanceof File)) {
    return csvUploadError(originalName, isExcelFileName(originalName));
  }

  if (!validateCsvImportUpload(file, buffer, CLINICAL_CSV_MAX_BYTES).ok) {
    return csvUploadError(originalName, isExcelFileName(originalName));
  }

  return null;
}

export async function validateClinicalCsvSource(
  content: string,
  originalName: string
): Promise<CsvImportFailure | null> {
  const { isHceExportCsv } = await import("@/lib/utils/hce-export-parse");
  if (isHceExportCsv(content, originalName)) {
    return {
      success: false,
      fileName: originalName,
      error:
        "Detectamos HCE_export.csv. Usá la tarjeta «Importar export HCE» justo debajo (no la plantilla de consultas).",
    };
  }

  const { consumersMisplacedMessage, looksLikeConsumersExport } = await import(
    "@/lib/utils/consumers-import-parse"
  );
  if (consumersMisplacedMessage(originalName) || looksLikeConsumersExport(content)) {
    return {
      success: false,
      fileName: originalName,
      error:
        "Detectamos el listado «consumers» (pacientes), no consultas. Subilo en Pacientes → Importar pacientes (Excel), no en Historias.",
    };
  }

  return null;
}

type PatientCacheEntry = { patientId: string; created: boolean };

export async function resolvePatientForCsvRow(input: {
  supabase: SupabaseClient;
  clinicId: string;
  row: ClinicalCsvRow;
  originalName: string;
  defaultInsurance: string | null;
  patientCache: Map<string, PatientCacheEntry>;
}): Promise<{ entry: PatientCacheEntry; created: boolean } | { error: string }> {
  let patientEntry = input.patientCache.get(input.row.document_number);
  if (patientEntry) return { entry: patientEntry, created: false };

  const extract: ExtractedPatientInfo = {
    document_number: input.row.document_number,
    last_name: input.row.last_name,
    first_name: input.row.first_name,
    source: "combined",
  };
  const patientResult = await findOrCreatePatientFromExtract(
    input.supabase,
    input.clinicId,
    extract,
    input.row.insurance_provider ?? input.defaultInsurance,
    `Paciente importado desde CSV: ${input.originalName}`
  );
  if ("error" in patientResult) {
    return { error: patientResult.error };
  }

  patientEntry = { patientId: patientResult.patientId, created: patientResult.created };
  input.patientCache.set(input.row.document_number, patientEntry);

  const patientUpdates: Record<string, string> = {};
  if (input.row.phone) patientUpdates.phone = sanitizeText(input.row.phone);
  if (input.row.insurance_number) {
    patientUpdates.insurance_number = sanitizeText(input.row.insurance_number);
  }
  if (input.row.insurance_provider) {
    patientUpdates.insurance_provider = sanitizeText(input.row.insurance_provider);
  }
  if (input.row.birth_date) patientUpdates.birth_date = input.row.birth_date;
  if (Object.keys(patientUpdates).length > 0) {
    await input.supabase
      .from("patients")
      .update(patientUpdates)
      .eq("id", patientResult.patientId)
      .eq("clinic_id", input.clinicId);
  }

  return { entry: patientEntry, created: patientResult.created };
}

export async function resolveProfessionalForCsvRow(input: {
  supabase: SupabaseClient;
  clinicId: string;
  professionalName: string;
  professionalCache: Map<string, string | null>;
}): Promise<string | null> {
  const proKey = input.professionalName.trim().toLowerCase() || "__default__";
  let professionalId = input.professionalCache.get(proKey);
  if (professionalId !== undefined) return professionalId;

  professionalId = await resolveImportProfessionalId(
    input.supabase,
    input.clinicId,
    input.professionalName || "Profesional"
  );
  input.professionalCache.set(proKey, professionalId);
  return professionalId;
}

export async function insertClinicalCsvRecord(input: {
  supabase: SupabaseClient;
  clinicId: string;
  userId: string;
  row: ClinicalCsvRow;
  patientId: string;
  professionalId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const createdAt = input.row.consultation_date
    ? `${input.row.consultation_date}T12:00:00.000Z`
    : new Date().toISOString();

  const { data: record, error } = await input.supabase
    .from("clinical_records")
    .insert({
      clinic_id: input.clinicId,
      patient_id: input.patientId,
      professional_id: input.professionalId,
      chief_complaint: sanitizeText(input.row.chief_complaint),
      evolution: sanitizeText(input.row.evolution),
      diagnosis: sanitizeText(input.row.diagnosis),
      indications: sanitizeText(input.row.indications),
      created_by: input.userId,
      created_at: createdAt,
      updated_at: createdAt,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };

  await input.supabase.from("clinical_record_audit").insert({
    clinical_record_id: record.id,
    clinic_id: input.clinicId,
    action: "create",
    changed_by: input.userId,
    new_values: { source: "clinical_csv_import", marker: input.row.import_marker },
  });

  return { ok: true };
}
