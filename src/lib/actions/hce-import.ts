"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getActiveClinic, getActiveClinicId, getSession, logAudit } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions/roles";
import {
  HCE_EXPORT_MAX_BYTES,
  HCE_EXPORT_MAX_ROWS,
  HCE_IMPORT_BATCH_SIZE,
} from "@/lib/constants/clinical-documents";
import { findOrCreatePatientFromExtract, resolveImportProfessionalId } from "@/lib/utils/clinical-pdf-import";
import {
  buildPatientHceCsv,
  groupHceRowsByPatient,
  hceRowToClinicalRecord,
  parseHceExportCsv,
  placeholderDniFromConsumerId,
} from "@/lib/utils/hce-export-parse";
import { sanitizeText } from "@/lib/validations/schemas";
import type { ExtractedPatientInfo } from "@/lib/utils/pdf-patient-extract";
import type { HceExportRow } from "@/lib/utils/hce-export-parse";

const BUCKET = "clinical-files";
const HCE_ATTACHMENT_NAME = "hce-export-resumen.csv";

async function requireHceImportAccess() {
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

export type ImportHceExportResult =
  | {
      success: true;
      fileName: string;
      recordsCreated: number;
      recordsSkipped: number;
      patientsCreated: number;
      attachmentsCreated: number;
      parseErrors: string[];
      totalRecords: number;
      processedThrough: number;
      hasMore: boolean;
      nextOffset: number;
    }
  | { success: false; fileName: string; error: string };

async function findPatientByConsumerRef(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clinicId: string,
  consumerRef: string
) {
  const { data } = await supabase
    .from("patients")
    .select("id")
    .eq("clinic_id", clinicId)
    .ilike("notes", `%${consumerRef}%`)
    .maybeSingle();
  return data?.id ?? null;
}

async function resolvePatientForHceRow(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clinicId: string,
  row: HceExportRow,
  defaultInsurance: string | null,
  importNote: string
): Promise<{ patientId: string; created: boolean } | { error: string }> {
  const existingId = await findPatientByConsumerRef(supabase, clinicId, row.paciente_id);
  if (existingId) return { patientId: existingId, created: false };

  const document_number =
    row.document_number ?? placeholderDniFromConsumerId(row.paciente_id);

  const extract: ExtractedPatientInfo = {
    document_number,
    first_name: row.first_name,
    last_name: row.last_name,
    source: "combined",
  };

  const result = await findOrCreatePatientFromExtract(
    supabase,
    clinicId,
    extract,
    defaultInsurance,
    `${importNote}\nImport ${row.paciente_id}`
  );

  if ("error" in result) return { error: result.error };

  const noteLine = `Import ${row.paciente_id}`;
  const { data: patient } = await supabase
    .from("patients")
    .select("notes")
    .eq("id", result.patientId)
    .single();
  if (!patient?.notes?.includes(row.paciente_id)) {
    const notes = patient?.notes?.trim()
      ? `${patient.notes.trim()}\n${noteLine}`
      : noteLine;
    await supabase
      .from("patients")
      .update({ notes: sanitizeText(notes) })
      .eq("id", result.patientId);
  }

  return { patientId: result.patientId, created: result.created };
}

async function ensureHceAttachment(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clinicId: string,
  userId: string,
  patientId: string,
  consumerRef: string,
  allRowsForPatient: HceExportRow[]
): Promise<boolean> {
  const { data: existing } = await supabase
    .from("patient_attachments")
    .select("id")
    .eq("patient_id", patientId)
    .eq("clinic_id", clinicId)
    .eq("file_name", HCE_ATTACHMENT_NAME)
    .maybeSingle();

  if (existing) return false;

  const csv = buildPatientHceCsv(allRowsForPatient);
  const buffer = Buffer.from(csv, "utf-8");
  const filePath = `${clinicId}/patients/${patientId}/${randomUUID()}-${HCE_ATTACHMENT_NAME}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(filePath, buffer, { contentType: "text/csv", upsert: false });

  if (uploadError) return false;

  await supabase.from("patient_attachments").insert({
    patient_id: patientId,
    clinic_id: clinicId,
    file_name: HCE_ATTACHMENT_NAME,
    file_path: filePath,
    file_type: "text/csv",
    file_size: buffer.length,
    category: "historia_clinica",
    uploaded_by: userId,
  });

  return true;
}

export async function importHceExportCsv(formData: FormData): Promise<ImportHceExportResult> {
  try {
    return await importHceExportCsvInner(formData);
  } catch (err) {
    console.error("[hce-import] failed:", err);
    const f = formData.get("file");
    return {
      success: false,
      fileName: f instanceof File ? f.name : "HCE_export.csv",
      error: "La importación HCE se interrumpió. Reintentá; el progreso parcial puede estar en Pacientes.",
    };
  }
}

async function importHceExportCsvInner(formData: FormData): Promise<ImportHceExportResult> {
  const access = await requireHceImportAccess();
  if (access.error || !access.clinicId || !access.userId) {
    return { success: false, fileName: "", error: access.error ?? "Sin permisos" };
  }

  const file = formData.get("file");
  const originalName = file instanceof File ? file.name : "HCE_export.csv";

  if (!(file instanceof File) || file.size === 0 || file.size > HCE_EXPORT_MAX_BYTES) {
    return {
      success: false,
      fileName: originalName,
      error: "CSV HCE inválido o mayor a 15 MB.",
    };
  }

  const content = await file.text();
  const offset = Math.max(0, Number(formData.get("offset") ?? 0) || 0);
  const { rows, errors } = parseHceExportCsv(content, HCE_EXPORT_MAX_ROWS);

  if (rows.length === 0) {
    return {
      success: false,
      fileName: originalName,
      error: errors[0] ?? "No hay filas en el export HCE.",
    };
  }

  const grouped = groupHceRowsByPatient(rows);
  const batch = rows.slice(offset, offset + HCE_IMPORT_BATCH_SIZE);
  if (batch.length === 0) {
    return {
      success: false,
      fileName: originalName,
      error: "Lote vacío. Volvé a subir el archivo desde el inicio.",
    };
  }

  const supabase = await createClient();
  const { data: clinic } = await supabase
    .from("clinics")
    .select("default_insurance_provider")
    .eq("id", access.clinicId)
    .single();

  const defaultInsurance = clinic?.default_insurance_provider ?? null;
  const professionalId = await resolveImportProfessionalId(
    supabase,
    access.clinicId,
    "Profesional"
  );
  if (!professionalId) {
    return {
      success: false,
      fileName: originalName,
      error: "No hay profesionales activos en la clínica.",
    };
  }

  let recordsCreated = 0;
  let recordsSkipped = 0;
  let patientsCreated = 0;
  let attachmentsCreated = 0;
  const parseErrors = offset === 0 ? [...errors] : [];
  const patientCache = new Map<string, string>();
  const touchedConsumers = new Set<string>();

  for (const row of batch) {
    touchedConsumers.add(row.paciente_id);
    let patientId = patientCache.get(row.paciente_id);
    if (!patientId) {
      const resolved = await resolvePatientForHceRow(
        supabase,
        access.clinicId,
        row,
        defaultInsurance,
        `Import HCE: ${originalName}`
      );
      if ("error" in resolved) {
        parseErrors.push(`Fila ${row.lineNumber}: ${resolved.error}`);
        continue;
      }
      patientId = resolved.patientId;
      patientCache.set(row.paciente_id, patientId);
      if (resolved.created) patientsCreated += 1;
    }

    const clinical = hceRowToClinicalRecord(row);
    if (clinical) {
      const { data: existing } = await supabase
        .from("clinical_records")
        .select("id")
        .eq("clinic_id", access.clinicId)
        .eq("patient_id", patientId)
        .ilike("chief_complaint", `${clinical.marker}%`)
        .maybeSingle();

      if (existing) {
        recordsSkipped += 1;
      } else {
        const createdAt = clinical.consultation_date
          ? `${clinical.consultation_date}T12:00:00.000Z`
          : new Date().toISOString();
        const { error: insertError } = await supabase.from("clinical_records").insert({
          clinic_id: access.clinicId,
          patient_id: patientId,
          professional_id: professionalId,
          chief_complaint: sanitizeText(clinical.chief_complaint),
          diagnosis: sanitizeText(clinical.diagnosis),
          evolution: sanitizeText(clinical.evolution),
          indications: sanitizeText(clinical.indications),
          created_by: access.userId,
          created_at: createdAt,
          updated_at: createdAt,
        });
        if (insertError) {
          parseErrors.push(`Fila ${row.lineNumber}: ${insertError.message}`);
        } else {
          recordsCreated += 1;
        }
      }
    }
  }

  for (const consumerRef of touchedConsumers) {
    const patientId = patientCache.get(consumerRef);
    if (!patientId) continue;
    const patientRows = grouped.get(consumerRef) ?? [];
    const created = await ensureHceAttachment(
      supabase,
      access.clinicId,
      access.userId,
      patientId,
      consumerRef,
      patientRows
    );
    if (created) attachmentsCreated += 1;
  }

  const processedThrough = offset + batch.length;
  const hasMore = processedThrough < rows.length;

  await logAudit({
    clinicId: access.clinicId,
    entityType: "clinical_record",
    entityId: access.clinicId,
    action: "create",
    metadata: {
      type: "hce_export_import",
      fileName: originalName,
      offset,
      recordsCreated,
      patientsCreated,
      attachmentsCreated,
      hasMore,
    },
  });

  revalidatePath("/historias");
  revalidatePath("/pacientes");

  return {
    success: true,
    fileName: originalName,
    recordsCreated,
    recordsSkipped,
    patientsCreated,
    attachmentsCreated,
    parseErrors: parseErrors.slice(0, 25),
    totalRecords: rows.length,
    processedThrough,
    hasMore,
    nextOffset: processedThrough,
  };
}
