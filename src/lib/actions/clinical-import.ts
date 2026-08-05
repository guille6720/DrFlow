"use server";

import { resolveImportAccess } from "@/core/actions/action-response";
import { logAudit } from "@/core/auth/session";
import { revalidateClinicalSurfaces } from "@/core/cache/revalidate-clinical";
import { requireClinicalImportAccess } from "@/core/services/import-access.service";
import { createClient } from "@/core/supabase/server";

import {
  insertClinicalCsvRecord,
  resolvePatientForCsvRow,
  resolveProfessionalForCsvRow,
  validateClinicalCsvFile,
  validateClinicalCsvSource,
} from "@/lib/actions/clinical-import.helpers";
import { CLINICAL_CSV_MAX_ROWS } from "@/lib/constants/clinical-documents";
import { parseClinicalCsvContent } from "@/lib/utils/clinical-csv-parse";

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
  const auth = resolveImportAccess(access);
  if (!auth.ok) return { success: false, fileName: "", error: auth.error };

  const file = formData.get("file");
  const originalName = file instanceof File ? file.name : "consultas.csv";
  const buffer = Buffer.from(
    file instanceof File ? await file.arrayBuffer() : new ArrayBuffer(0)
  );

  const fileError = validateClinicalCsvFile(file, originalName, buffer);
  if (fileError) return fileError;

  const content = buffer.toString("utf-8");
  const sourceError = await validateClinicalCsvSource(content, originalName);
  if (sourceError) return sourceError;

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
    .eq("id", auth.clinicId)
    .single();

  const defaultInsurance = clinic?.default_insurance_provider ?? null;
  const patientCache = new Map<string, { patientId: string; created: boolean }>();
  const professionalCache = new Map<string, string | null>();

  let recordsCreated = 0;
  let recordsSkipped = 0;
  let patientsCreated = 0;
  const rowErrors = [...parseErrors];

  for (const row of rows) {
    const patientResult = await resolvePatientForCsvRow({
      supabase,
      clinicId: auth.clinicId,
      row,
      originalName,
      defaultInsurance,
      patientCache,
    });
    if ("error" in patientResult) {
      rowErrors.push(`Fila ${row.lineNumber}: ${patientResult.error}`);
      continue;
    }
    if (patientResult.created) patientsCreated += 1;

    const { data: existing } = await supabase
      .from("clinical_records")
      .select("id")
      .eq("clinic_id", auth.clinicId)
      .eq("patient_id", patientResult.entry.patientId)
      .ilike("chief_complaint", `${row.import_marker}%`)
      .maybeSingle();

    if (existing) {
      recordsSkipped += 1;
      continue;
    }

    const professionalId = await resolveProfessionalForCsvRow({
      supabase,
      clinicId: auth.clinicId,
      professionalName: row.professional_name,
      professionalCache,
    });
    if (!professionalId) {
      rowErrors.push(`Fila ${row.lineNumber}: no hay profesionales activos en la clínica.`);
      continue;
    }

    const insertResult = await insertClinicalCsvRecord({
      supabase,
      clinicId: auth.clinicId,
      userId: auth.userId,
      row,
      patientId: patientResult.entry.patientId,
      professionalId,
    });
    if (!insertResult.ok) {
      rowErrors.push(`Fila ${row.lineNumber}: ${insertResult.error}`);
      continue;
    }

    recordsCreated += 1;
  }

  await logAudit({
    clinicId: auth.clinicId,
    entityType: "clinical_record",
    entityId: auth.clinicId,
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

  revalidateClinicalSurfaces();

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
