/**
 * Mapped spreadsheet import after explicit confirmation.
 * Demographic updates only; never overwrites clinical profile fields.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

import { logAudit } from "@/core/auth/session.actions";
import { sanitizeText } from "@/core/validations/schemas";

import {
  type DuplicateDecisionSet,
  resolveDuplicateDecision,
} from "@/features/integraciones/lib/patient-import-duplicates";
import type { PatientColumnMapping } from "@/features/integraciones/lib/patient-import-mapping";
import { trimImportValue } from "@/features/integraciones/lib/patient-import-normalize";
import { parsePatientSpreadsheet } from "@/features/integraciones/lib/patient-import-spreadsheet";
import {
  mapSpreadsheetRow,
  validatePatientImportRow,
} from "@/features/integraciones/lib/patient-import-validate";
import { withDefaultDecisions } from "@/features/integraciones/server/prepare-patient-import";

import { CONSUMERS_IMPORT_MAX_ROWS } from "@/lib/constants/clinical-documents";
import { findOrCreatePatientFromExtract } from "@/lib/utils/clinical-pdf-import";
import type { ExtractedPatientInfo } from "@/lib/utils/pdf-patient-extract";

export const MAPPED_PATIENT_IMPORT_BATCH_SIZE = 80;

export type MappedPatientImportResult =
  | {
      success: true;
      fileName: string;
      patientsCreated: number;
      patientsUpdated: number;
      patientsSkipped: number;
      patientsFailed: number;
      parseErrors: string[];
      totalRecords: number;
      processedThrough: number;
      hasMore: boolean;
      nextOffset: number;
    }
  | { success: false; fileName: string; error: string };

async function mergeDemographics(
  supabase: SupabaseClient,
  clinicId: string,
  patientId: string,
  record: {
    phone: string | null;
    email: string | null;
    insurance_provider: string | null;
    insurance_plan: string | null;
    insurance_number: string | null;
    birth_date: string | null;
    address: string | null;
    emergency_contact_name: string | null;
    emergency_contact_phone: string | null;
  }
): Promise<boolean> {
  const { data: patient } = await supabase
    .from("patients")
    .select(
      "phone, email, insurance_provider, insurance_plan, insurance_number, birth_date, address, emergency_contact_name, emergency_contact_phone"
    )
    .eq("id", patientId)
    .eq("clinic_id", clinicId)
    .single();

  if (!patient) return false;

  const updates: Record<string, string> = {};
  const fill = (column: string, incoming: string | null, current: string | null) => {
    if (!current?.trim() && incoming) updates[column] = sanitizeText(incoming);
  };

  fill("phone", record.phone, patient.phone);
  fill("email", record.email, patient.email);
  fill("insurance_provider", record.insurance_provider, patient.insurance_provider);
  fill("insurance_plan", record.insurance_plan, patient.insurance_plan);
  fill("insurance_number", record.insurance_number, patient.insurance_number);
  fill("address", record.address, patient.address);
  fill("emergency_contact_name", record.emergency_contact_name, patient.emergency_contact_name);
  fill("emergency_contact_phone", record.emergency_contact_phone, patient.emergency_contact_phone);
  if (!patient.birth_date && record.birth_date) updates.birth_date = record.birth_date;

  if (Object.keys(updates).length === 0) return false;
  await supabase.from("patients").update(updates).eq("id", patientId).eq("clinic_id", clinicId);
  return true;
}

export async function processMappedPatientImportBatch(
  supabase: SupabaseClient,
  params: {
    clinicId: string;
    userId: string;
    buffer: Buffer;
    originalName: string;
    mapping: PatientColumnMapping;
    decisions: DuplicateDecisionSet;
    dateFormat?: string | null;
    offset: number;
    limit?: number;
  }
): Promise<MappedPatientImportResult> {
  const { clinicId, buffer, originalName, mapping, offset } = params;
  const limit = params.limit ?? MAPPED_PATIENT_IMPORT_BATCH_SIZE;
  const decisions = withDefaultDecisions(params.decisions);

  let table;
  try {
    table = await parsePatientSpreadsheet(buffer, originalName);
  } catch (error) {
    return {
      success: false,
      fileName: originalName,
      error: error instanceof Error ? error.message : "No se pudo leer el archivo.",
    };
  }

  const rows = table.rows.slice(0, CONSUMERS_IMPORT_MAX_ROWS);
  const batch = rows.slice(offset, offset + limit);
  if (batch.length === 0) {
    return {
      success: false,
      fileName: originalName,
      error: "Lote de importación vacío.",
    };
  }

  const prepared = batch.map((cells, i) => {
    const lineNumber = offset + i + 2;
    return {
      lineNumber,
      cells,
      mapped: mapSpreadsheetRow(cells, mapping, lineNumber, params.dateFormat),
    };
  });

  const documents = prepared
    .map((item) => item.mapped.document_number)
    .filter((value): value is string => Boolean(value));

  const { data: existingByDocument } = documents.length
    ? await supabase
        .from("patients")
        .select("id, first_name, last_name, birth_date, document_number")
        .eq("clinic_id", clinicId)
        .in("document_number", documents)
    : { data: [] as Array<{ id: string; document_number: string }> };

  const byDocument = new Map((existingByDocument ?? []).map((row) => [row.document_number, row]));

  const lastNames = [...new Set(prepared.map((item) => item.mapped.last_name).filter(Boolean))];
  const { data: existingByName } = lastNames.length
    ? await supabase
        .from("patients")
        .select("id, first_name, last_name, birth_date, document_number")
        .eq("clinic_id", clinicId)
        .in("last_name", lastNames)
        .limit(500)
    : { data: [] as Array<{ id: string; last_name: string; first_name: string; birth_date: string | null }> };

  const byNameDob = new Map(
    (existingByName ?? []).map((row) => [
      `${row.last_name}|${row.first_name}|${row.birth_date ?? ""}`,
      row,
    ])
  );

  let patientsCreated = 0;
  let patientsUpdated = 0;
  let patientsSkipped = 0;
  let patientsFailed = 0;
  const parseErrors: string[] = [];

  for (const item of prepared) {
    const { lineNumber, cells, mapped } = item;
    const issues = validatePatientImportRow(mapped, {
      document: mapping.document_number ? trimImportValue(cells[mapping.document_number]) : "",
      birthDate: mapping.birth_date ? trimImportValue(cells[mapping.birth_date]) : "",
    });
    if (issues.length > 0 || !mapped.document_number) {
      patientsFailed += 1;
      parseErrors.push(issues[0]?.message ?? `Fila ${lineNumber}: inválida.`);
      continue;
    }

    const existing = byDocument.get(mapped.document_number) ?? null;
    const nameKey = `${mapped.last_name}|${mapped.first_name}|${mapped.birth_date ?? ""}`;
    const nameMatch = !existing && mapped.birth_date ? byNameDob.get(nameKey) ?? null : null;
    const matchType: "document" | "name_dob" | null = existing
      ? "document"
      : nameMatch
        ? "name_dob"
        : null;

    const decision = resolveDuplicateDecision(decisions, lineNumber, matchType);

    if (decision === "skip" || decision === "keep" || decision === "review") {
      patientsSkipped += 1;
      continue;
    }

    if (decision === "create" && existing) {
      patientsFailed += 1;
      parseErrors.push(
        `Fila ${lineNumber}: no se puede crear otro paciente con el mismo DNI (${mapped.document_number}).`
      );
      continue;
    }

    if (decision === "update") {
      const target = existing ?? nameMatch;
      if (!target) {
        patientsFailed += 1;
        parseErrors.push(`Fila ${lineNumber}: no hay paciente existente para actualizar.`);
        continue;
      }
      const updated = await mergeDemographics(supabase, clinicId, target.id, mapped);
      if (updated) patientsUpdated += 1;
      else patientsSkipped += 1;
      continue;
    }

    const extract: ExtractedPatientInfo = {
      document_number: mapped.document_number,
      first_name: mapped.first_name,
      last_name: mapped.last_name,
      source: "combined",
    };

    const created = await findOrCreatePatientFromExtract(
      supabase,
      clinicId,
      extract,
      mapped.insurance_provider,
      `Import pacientes: ${originalName}`
    );

    if ("error" in created) {
      patientsFailed += 1;
      parseErrors.push(`Fila ${lineNumber}: ${created.error}`);
      continue;
    }

    if (created.created) {
      await mergeDemographics(supabase, clinicId, created.patientId, mapped);
      patientsCreated += 1;
    } else {
      const updated = await mergeDemographics(supabase, clinicId, created.patientId, mapped);
      if (updated) patientsUpdated += 1;
      else patientsSkipped += 1;
    }
  }

  const processedThrough = offset + batch.length;
  const hasMore = processedThrough < rows.length;

  await logAudit({
    clinicId,
    entityType: "data_import_session",
    entityId: clinicId,
    action: "create",
    metadata: {
      type: "patients_mapped_import",
      fileName: originalName,
      patientsCreated,
      patientsUpdated,
      patientsSkipped,
      patientsFailed,
      batchOffset: offset,
      totalRows: rows.length,
      hasMore,
    },
  });

  revalidatePath("/pacientes");
  revalidatePath("/datos");

  return {
    success: true,
    fileName: originalName,
    patientsCreated,
    patientsUpdated,
    patientsSkipped,
    patientsFailed,
    parseErrors: parseErrors.slice(0, 25),
    totalRecords: rows.length,
    processedThrough,
    hasMore,
    nextOffset: processedThrough,
  };
}
