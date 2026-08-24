import type { SupabaseClient } from "@supabase/supabase-js";

import { insertClinicalRecordCreationAudit } from "@/core/compliance/clinical-record-integrity";
import { sanitizeText } from "@/core/validations/schemas";

import { type HceExportRow, hceRowToClinicalRecord } from "@/lib/utils/hce-export-parse";

export async function findExistingClinicalRecord(
  supabase: SupabaseClient,
  clinicId: string,
  patientId: string,
  row: HceExportRow,
  clinical: NonNullable<ReturnType<typeof hceRowToClinicalRecord>>
) {
  const importId = row.import_record_id;
  let existingQuery = supabase
    .from("clinical_records")
    .select("id")
    .eq("clinic_id", clinicId)
    .eq("patient_id", patientId);

  if (importId) {
    const escaped = importId.replace(/,/g, "");
    existingQuery = existingQuery.or(
      `chief_complaint.ilike.[IMPORT:${escaped}]%,chief_complaint.ilike.[DRAPP:${escaped}]%`
    );
  } else {
    existingQuery = existingQuery.ilike("chief_complaint", `${clinical.marker}%`);
  }

  return existingQuery.maybeSingle();
}

export async function insertTeamsJsonlClinicalRecord(input: {
  supabase: SupabaseClient;
  clinicId: string;
  userId: string;
  patientId: string;
  professionalId: string;
  clinical: NonNullable<ReturnType<typeof hceRowToClinicalRecord>>;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const createdAt = input.clinical.consultation_date
    ? `${input.clinical.consultation_date}T12:00:00.000Z`
    : new Date().toISOString();

  const { data: record, error: insertError } = await input.supabase.from("clinical_records").insert({
    clinic_id: input.clinicId,
    patient_id: input.patientId,
    professional_id: input.professionalId,
    chief_complaint: sanitizeText(input.clinical.chief_complaint),
    diagnosis: sanitizeText(input.clinical.diagnosis),
    evolution: sanitizeText(input.clinical.evolution),
    indications: sanitizeText(input.clinical.indications),
    created_by: input.userId,
    created_at: createdAt,
    updated_at: createdAt,
  }).select("id").single();

  if (insertError) return { ok: false, error: insertError.message };

  if (record?.id) {
    await insertClinicalRecordCreationAudit(input.supabase, {
      clinicalRecordId: record.id,
      clinicId: input.clinicId,
      patientId: input.patientId,
      changedBy: input.userId,
      source: "teams_jsonl_import",
      marker: input.clinical.marker,
    });
  }

  return { ok: true };
}

export async function processTeamsJsonlImportRow(input: {
  supabase: SupabaseClient;
  clinicId: string;
  userId: string;
  professionalId: string;
  row: HceExportRow;
  patientCache: Map<string, string>;
  resolvePatient: (
    row: HceExportRow
  ) => Promise<{ patientId: string; created: boolean } | { error: string }>;
}): Promise<
  | { action: "ignore"; patientsCreated: number }
  | { action: "skip"; patientsCreated: number }
  | { action: "created"; patientsCreated: number }
  | { action: "error"; message: string; patientsCreated: number }
> {
  let patientsCreated = 0;
  let patientId = input.patientCache.get(input.row.paciente_id);
  if (!patientId) {
    const resolved = await input.resolvePatient(input.row);
    if ("error" in resolved) {
      return {
        action: "error",
        message: `Registro ${input.row.import_record_id ?? input.row.lineNumber}: ${resolved.error}`,
        patientsCreated: 0,
      };
    }
    patientId = resolved.patientId;
    input.patientCache.set(input.row.paciente_id, patientId);
    if (resolved.created) patientsCreated = 1;
  }

  const clinical = hceRowToClinicalRecord(input.row);
  if (!clinical) {
    return { action: "ignore", patientsCreated };
  }

  const { data: existing } = await findExistingClinicalRecord(
    input.supabase,
    input.clinicId,
    patientId,
    input.row,
    clinical
  );

  if (existing) {
    return { action: "skip", patientsCreated };
  }

  const insertResult = await insertTeamsJsonlClinicalRecord({
    supabase: input.supabase,
    clinicId: input.clinicId,
    userId: input.userId,
    patientId,
    professionalId: input.professionalId,
    clinical,
  });

  if (!insertResult.ok) {
    return {
      action: "error",
      message: `Registro ${input.row.import_record_id ?? input.row.lineNumber}: ${insertResult.error}`,
      patientsCreated,
    };
  }

  return { action: "created", patientsCreated };
}
