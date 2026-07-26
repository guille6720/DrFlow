"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getActiveClinic, getActiveClinicId, getSession, logAudit } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions/roles";
import {
  CLINICAL_CSV_MAX_BYTES,
  CLINICAL_CSV_MAX_ROWS,
} from "@/lib/constants/clinical-documents";
import {
  findOrCreatePatientFromExtract,
  resolveImportProfessionalId,
} from "@/lib/utils/clinical-pdf-import";
import { parseClinicalCsvContent } from "@/lib/utils/clinical-csv-parse";
import { sanitizeText } from "@/lib/validations/schemas";
import type { ExtractedPatientInfo } from "@/lib/utils/pdf-patient-extract";

async function requireClinicalImportAccess() {
  const clinicId = await getActiveClinicId();
  const { role, isSuperadmin } = await getActiveClinic();
  const canImport =
    hasPermission(role, "editClinicalRecords", isSuperadmin) ||
    hasPermission(role, "managePatients", isSuperadmin);
  if (!clinicId || !canImport) {
    return { error: "Sin permisos" as const, clinicId: null, userId: null };
  }
  const user = await getSession();
  if (!user) return { error: "Sesión requerida" as const, clinicId: null, userId: null };
  return { error: null, clinicId, userId: user.id };
}

function validateCsvFile(file: unknown): file is File {
  if (!(file instanceof File) || file.size === 0) return false;
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  const okType =
    type === "text/csv" ||
    type === "application/vnd.ms-excel" ||
    type === "text/plain" ||
    name.endsWith(".csv");
  return okType && file.size <= CLINICAL_CSV_MAX_BYTES;
}

export type ImportClinicalCsvResult =
  | {
      success: true;
      fileName: string;
      recordsCreated: number;
      recordsSkipped: number;
      patientsCreated: number;
      parseErrors: string[];
    }
  | {
      success: false;
      fileName: string;
      error: string;
    };

export async function importClinicalCsv(formData: FormData): Promise<ImportClinicalCsvResult> {
  const access = await requireClinicalImportAccess();
  if (access.error || !access.clinicId || !access.userId) {
    return { success: false, fileName: "", error: access.error ?? "Sin permisos" };
  }

  const file = formData.get("file");
  const originalName = file instanceof File ? file.name : "consultas.csv";

  if (!validateCsvFile(file)) {
    const lower = originalName.toLowerCase();
    if (
      lower.endsWith(".xlsx") ||
      lower.endsWith(".xls") ||
      lower.endsWith(".csv.xlsx")
    ) {
      return {
        success: false,
        fileName: originalName,
        error:
          "Este archivo Excel es el export de pacientes (consumers). No va acá: andá a Pacientes → Importar pacientes (Excel).",
      };
    }
    return {
      success: false,
      fileName: originalName,
      error: "Archivo CSV inválido o mayor a 8 MB. Usá extensión .csv",
    };
  }

  const content = await file.text();
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
  if (
    consumersMisplacedMessage(originalName) ||
    looksLikeConsumersExport(content)
  ) {
    return {
      success: false,
      fileName: originalName,
      error:
        "Detectamos el listado «consumers» (pacientes), no consultas. Subilo en Pacientes → Importar pacientes (Excel), no en Historias.",
    };
  }

  const { rows, errors: parseErrors } = parseClinicalCsvContent(content, CLINICAL_CSV_MAX_ROWS);

  if (rows.length === 0) {
    return {
      success: false,
      fileName: originalName,
      error: parseErrors[0] ?? "No hay filas válidas para importar.",
    };
  }

  const supabase = await createClient();
  const { data: clinic } = await supabase
    .from("clinics")
    .select("default_insurance_provider")
    .eq("id", access.clinicId)
    .single();

  const defaultInsurance = clinic?.default_insurance_provider ?? null;
  const patientCache = new Map<string, { patientId: string; created: boolean }>();
  const professionalCache = new Map<string, string | null>();

  let recordsCreated = 0;
  let recordsSkipped = 0;
  let patientsCreated = 0;
  const rowErrors = [...parseErrors];

  for (const row of rows) {
    let patientEntry = patientCache.get(row.document_number);
    if (!patientEntry) {
      const extract: ExtractedPatientInfo = {
        document_number: row.document_number,
        last_name: row.last_name,
        first_name: row.first_name,
        source: "combined",
      };
      const patientResult = await findOrCreatePatientFromExtract(
        supabase,
        access.clinicId,
        extract,
        row.insurance_provider ?? defaultInsurance,
        `Paciente importado desde CSV: ${originalName}`
      );
      if ("error" in patientResult) {
        rowErrors.push(`Fila ${row.lineNumber}: ${patientResult.error}`);
        continue;
      }
      patientEntry = { patientId: patientResult.patientId, created: patientResult.created };
      patientCache.set(row.document_number, patientEntry);
      if (patientResult.created) patientsCreated += 1;

      const patientUpdates: Record<string, string> = {};
      if (row.phone) patientUpdates.phone = sanitizeText(row.phone);
      if (row.insurance_number) patientUpdates.insurance_number = sanitizeText(row.insurance_number);
      if (row.insurance_provider) {
        patientUpdates.insurance_provider = sanitizeText(row.insurance_provider);
      }
      if (row.birth_date) patientUpdates.birth_date = row.birth_date;
      if (Object.keys(patientUpdates).length > 0) {
        await supabase
          .from("patients")
          .update(patientUpdates)
          .eq("id", patientResult.patientId)
          .eq("clinic_id", access.clinicId);
      }
    }

    const { data: existing } = await supabase
      .from("clinical_records")
      .select("id")
      .eq("clinic_id", access.clinicId)
      .eq("patient_id", patientEntry.patientId)
      .ilike("chief_complaint", `${row.import_marker}%`)
      .maybeSingle();

    if (existing) {
      recordsSkipped += 1;
      continue;
    }

    const proKey = row.professional_name.trim().toLowerCase() || "__default__";
    let professionalId = professionalCache.get(proKey);
    if (professionalId === undefined) {
      professionalId = await resolveImportProfessionalId(
        supabase,
        access.clinicId,
        row.professional_name || "Profesional"
      );
      professionalCache.set(proKey, professionalId);
    }
    if (!professionalId) {
      rowErrors.push(
        `Fila ${row.lineNumber}: no hay profesionales activos en la clínica.`
      );
      continue;
    }

    const createdAt = row.consultation_date
      ? `${row.consultation_date}T12:00:00.000Z`
      : new Date().toISOString();

    const { data: record, error } = await supabase
      .from("clinical_records")
      .insert({
        clinic_id: access.clinicId,
        patient_id: patientEntry.patientId,
        professional_id: professionalId,
        chief_complaint: sanitizeText(row.chief_complaint),
        evolution: sanitizeText(row.evolution),
        diagnosis: sanitizeText(row.diagnosis),
        indications: sanitizeText(row.indications),
        created_by: access.userId,
        created_at: createdAt,
        updated_at: createdAt,
      })
      .select("id")
      .single();

    if (error) {
      rowErrors.push(`Fila ${row.lineNumber}: ${error.message}`);
      continue;
    }

    await supabase.from("clinical_record_audit").insert({
      clinical_record_id: record.id,
      clinic_id: access.clinicId,
      action: "create",
      changed_by: access.userId,
      new_values: { source: "clinical_csv_import", marker: row.import_marker },
    });

    recordsCreated += 1;
  }

  await logAudit({
    clinicId: access.clinicId,
    entityType: "clinical_record",
    entityId: access.clinicId,
    action: "create",
    metadata: {
      type: "clinical_csv_import",
      fileName: originalName,
      recordsCreated,
      recordsSkipped,
      patientsCreated,
      parseErrorCount: rowErrors.length,
    },
  });

  revalidatePath("/historias");
  revalidatePath("/pacientes");

  if (recordsCreated === 0 && recordsSkipped === 0) {
    return {
      success: false,
      fileName: originalName,
      error: rowErrors[0] ?? "No se pudo importar ninguna consulta.",
    };
  }

  return {
    success: true,
    fileName: originalName,
    recordsCreated,
    recordsSkipped,
    patientsCreated,
    parseErrors: rowErrors.slice(0, 25),
  };
}
