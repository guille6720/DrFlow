"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getActiveClinic, getActiveClinicId, getSession, logAudit } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions/roles";
import { DRAPP_CONSUMERS_MAX_BYTES, DRAPP_CONSUMERS_MAX_ROWS } from "@/lib/constants/clinical-documents";
import { parseDrAppConsumersUpload } from "@/lib/utils/drapp-consumers-import.server";
import { findOrCreatePatientFromExtract } from "@/lib/utils/clinical-pdf-import";
import { sanitizeText } from "@/lib/validations/schemas";
import type { ExtractedPatientInfo } from "@/lib/utils/pdf-patient-extract";

async function requirePatientImportAccess() {
  const clinicId = await getActiveClinicId();
  const { role, isSuperadmin } = await getActiveClinic();
  if (!clinicId || !hasPermission(role, "managePatients", isSuperadmin)) {
    return { error: "Sin permisos" as const, clinicId: null, userId: null };
  }
  const user = await getSession();
  if (!user) return { error: "Sesión requerida" as const, clinicId: null, userId: null };
  return { error: null, clinicId, userId: user.id };
}

function validateDrAppConsumersFile(file: unknown, fileName: string): file is File {
  if (!(file instanceof File) || file.size === 0) return false;
  const lower = fileName.toLowerCase();
  const okExt =
    lower.endsWith(".xlsx") ||
    lower.endsWith(".xls") ||
    lower.endsWith(".csv") ||
    lower.endsWith(".csv.xlsx");
  return okExt && file.size <= DRAPP_CONSUMERS_MAX_BYTES;
}

export type ImportDrAppConsumersResult =
  | {
      success: true;
      fileName: string;
      patientsCreated: number;
      patientsUpdated: number;
      patientsSkipped: number;
      parseErrors: string[];
      format: string;
      totalRecords: number;
      processedThrough: number;
      hasMore: boolean;
      nextOffset: number;
    }
  | {
      success: false;
      fileName: string;
      error: string;
    };

const IMPORT_BATCH_SIZE = 80;

async function mergePatientFields(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clinicId: string,
  patientId: string,
  record: {
    phone: string | null;
    email: string | null;
    insurance_provider: string | null;
    insurance_number: string | null;
    birth_date: string | null;
    drapp_consumer_id: string | null;
  }
) {
  const { data: patient } = await supabase
    .from("patients")
    .select("phone, email, insurance_provider, insurance_number, birth_date, notes")
    .eq("id", patientId)
    .eq("clinic_id", clinicId)
    .single();

  if (!patient) return false;

  const updates: Record<string, string> = {};
  if (!patient.phone?.trim() && record.phone) updates.phone = sanitizeText(record.phone);
  if (!patient.email?.trim() && record.email) updates.email = sanitizeText(record.email);
  if (!patient.insurance_number?.trim() && record.insurance_number) {
    updates.insurance_number = sanitizeText(record.insurance_number);
  }
  if (!patient.insurance_provider?.trim() && record.insurance_provider) {
    updates.insurance_provider = sanitizeText(record.insurance_provider);
  }
  if (!patient.birth_date && record.birth_date) updates.birth_date = record.birth_date;

  if (record.drapp_consumer_id && !patient.notes?.includes(record.drapp_consumer_id)) {
    const note = `DrApp ID: ${record.drapp_consumer_id}`;
    updates.notes = patient.notes?.trim() ? `${patient.notes.trim()}\n${note}` : note;
    updates.notes = sanitizeText(updates.notes);
  }

  if (Object.keys(updates).length === 0) return false;

  await supabase.from("patients").update(updates).eq("id", patientId).eq("clinic_id", clinicId);
  return true;
}

export async function importDrAppConsumersFile(
  formData: FormData
): Promise<ImportDrAppConsumersResult> {
  try {
    return await importDrAppConsumersFileInner(formData);
  } catch (err) {
    console.error("[patient-import] drapp consumers failed:", err);
    const f = formData.get("file");
    const fileName = f instanceof File ? f.name : "archivo";
    return {
      success: false,
      fileName,
      error:
        "La importación se interrumpió (tiempo de servidor o error interno). Probá de nuevo; si persiste, contactá soporte.",
    };
  }
}

async function importDrAppConsumersFileInner(
  formData: FormData
): Promise<ImportDrAppConsumersResult> {
  const access = await requirePatientImportAccess();
  if (access.error || !access.clinicId || !access.userId) {
    return { success: false, fileName: "", error: access.error ?? "Sin permisos" };
  }

  const file = formData.get("file");
  const originalName = file instanceof File ? file.name : "consumers.xlsx";

  if (!validateDrAppConsumersFile(file, originalName)) {
    return {
      success: false,
      fileName: originalName,
      error: "Archivo inválido. Aceptamos .xlsx, .csv o .csv.xlsx de DrApp (máx. 15 MB).",
    };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const offset = Math.max(0, Number(formData.get("offset") ?? 0) || 0);
  const limit = Math.min(
    IMPORT_BATCH_SIZE,
    Math.max(1, Number(formData.get("limit") ?? IMPORT_BATCH_SIZE) || IMPORT_BATCH_SIZE)
  );

  const { records, errors, format } = await parseDrAppConsumersUpload(
    buffer,
    originalName,
    DRAPP_CONSUMERS_MAX_ROWS
  );

  if (records.length === 0) {
    return {
      success: false,
      fileName: originalName,
      error: errors[0] ?? "No hay pacientes válidos para importar.",
    };
  }

  const batch = records.slice(offset, offset + limit);
  if (batch.length === 0) {
    return {
      success: false,
      fileName: originalName,
      error: "Lote de importación vacío. Volvé a subir el archivo desde el inicio.",
    };
  }

  const supabase = await createClient();
  const { data: clinic } = await supabase
    .from("clinics")
    .select("default_insurance_provider")
    .eq("id", access.clinicId)
    .single();

  let patientsCreated = 0;
  let patientsUpdated = 0;
  let patientsSkipped = 0;
  const parseErrors = offset === 0 ? [...errors] : [];

  for (const record of batch) {
    const extract: ExtractedPatientInfo = {
      document_number: record.document_number,
      first_name: record.first_name,
      last_name: record.last_name,
      source: "combined",
    };

    const patientResult = await findOrCreatePatientFromExtract(
      supabase,
      access.clinicId,
      extract,
      record.insurance_provider ?? clinic?.default_insurance_provider ?? null,
      `Import DrApp consumers: ${originalName}`
    );

    if ("error" in patientResult) {
      parseErrors.push(`Fila ${record.lineNumber}: ${patientResult.error}`);
      continue;
    }

    if (patientResult.created) {
      patientsCreated += 1;
      await mergePatientFields(supabase, access.clinicId, patientResult.patientId, record);
      continue;
    }

    const updated = await mergePatientFields(
      supabase,
      access.clinicId,
      patientResult.patientId,
      record
    );
    if (updated) patientsUpdated += 1;
    else patientsSkipped += 1;
  }

  const processedThrough = offset + batch.length;
  const hasMore = processedThrough < records.length;

  await logAudit({
    clinicId: access.clinicId,
    entityType: "patient",
    entityId: access.clinicId,
    action: "create",
    metadata: {
      type: "drapp_consumers_import",
      fileName: originalName,
      format,
      patientsCreated,
      patientsUpdated,
      patientsSkipped,
      batchOffset: offset,
      batchSize: batch.length,
      totalRows: records.length,
      hasMore,
    },
  });

  revalidatePath("/pacientes");
  revalidatePath("/historias");

  return {
    success: true,
    fileName: originalName,
    patientsCreated,
    patientsUpdated,
    patientsSkipped,
    parseErrors: parseErrors.slice(0, 25),
    format,
    totalRecords: records.length,
    processedThrough,
    hasMore,
    nextOffset: processedThrough,
  };
}
