/**
 * Internal batch processor for consumers import (jobs / authenticated actions).
 * Not a Server Action — not callable from the client.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

import { logAudit } from "@/core/auth/session.actions";
import { sanitizeText } from "@/core/validations/schemas";

import {
  loadPatientClinicalProfile,
  upsertPatientClinicalProfile,
} from "@/features/pacientes/server/patient-clinical-profile";

import { CONSUMERS_IMPORT_MAX_ROWS } from "@/lib/constants/clinical-documents";
import { findOrCreatePatientFromExtract } from "@/lib/utils/clinical-pdf-import";
import { parseConsumersUpload } from "@/lib/utils/consumers-import.server";
import type { ExtractedPatientInfo } from "@/lib/utils/pdf-patient-extract";

export type ImportConsumersResult =
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
  supabase: SupabaseClient,
  clinicId: string,
  patientId: string,
  record: {
    phone: string | null;
    email: string | null;
    insurance_provider: string | null;
    insurance_number: string | null;
    birth_date: string | null;
    external_consumer_id: string | null;
  }
) {
  const { data: patient } = await supabase
    .from("patients")
    .select("phone, email, insurance_provider, insurance_number, birth_date")
    .eq("id", patientId)
    .eq("clinic_id", clinicId)
    .single();

  if (!patient) return false;

  const profile = await loadPatientClinicalProfile(supabase, patientId, clinicId);

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

  let profileNotesUpdated = false;
  if (record.external_consumer_id && !profile?.notes?.includes(record.external_consumer_id)) {
    const note = `ID importación: ${record.external_consumer_id}`;
    const notes = profile?.notes?.trim() ? `${profile.notes.trim()}\n${note}` : note;
    const { error: profileError } = await upsertPatientClinicalProfile(supabase, patientId, clinicId, {
      notes: sanitizeText(notes),
    });
    if (profileError) return false;
    profileNotesUpdated = true;
  }

  if (Object.keys(updates).length === 0) return profileNotesUpdated;

  await supabase.from("patients").update(updates).eq("id", patientId).eq("clinic_id", clinicId);
  return true;
}

export async function processConsumersImportBatchFromBuffer(
  supabase: SupabaseClient,
  params: {
    clinicId: string;
    userId: string;
    buffer: Buffer;
    originalName: string;
    offset: number;
    limit?: number;
  }
): Promise<ImportConsumersResult> {
  const { clinicId, buffer, originalName, offset } = params;
  const limit = params.limit ?? IMPORT_BATCH_SIZE;

  const { records, errors, format } = await parseConsumersUpload(
    buffer,
    originalName,
    CONSUMERS_IMPORT_MAX_ROWS
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

  const { data: clinic } = await supabase
    .from("clinics")
    .select("default_insurance_provider")
    .eq("id", clinicId)
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
      clinicId,
      extract,
      record.insurance_provider ?? clinic?.default_insurance_provider ?? null,
      `Import consumers: ${originalName}`
    );

    if ("error" in patientResult) {
      parseErrors.push(`Fila ${record.lineNumber}: ${patientResult.error}`);
      continue;
    }

    if (patientResult.created) {
      patientsCreated += 1;
      await mergePatientFields(supabase, clinicId, patientResult.patientId, record);
      continue;
    }

    const updated = await mergePatientFields(
      supabase,
      clinicId,
      patientResult.patientId,
      record
    );
    if (updated) patientsUpdated += 1;
    else patientsSkipped += 1;
  }

  const processedThrough = offset + batch.length;
  const hasMore = processedThrough < records.length;

  await logAudit({
    clinicId,
    entityType: "patient",
    entityId: clinicId,
    action: "create",
    metadata: {
      type: "consumers_import",
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

export { IMPORT_BATCH_SIZE };
