"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/core/supabase/server";
import { getActiveClinic, getActiveClinicId, getSession, logAudit } from "@/core/auth/session";
import { hasPermission } from "@/core/permissions/roles";
import { TEAMS_JSONL_IMPORT_BATCH_SIZE } from "@/lib/constants/clinical-documents";
import { findOrCreatePatientFromExtract, resolveImportProfessionalId } from "@/lib/utils/clinical-pdf-import";
import {
  hceRowToClinicalRecord,
  placeholderDniFromConsumerId,
  type HceExportRow,
} from "@/lib/utils/hce-export-parse";
import { sanitizeText } from "@/core/validations/schemas";
import type { ExtractedPatientInfo } from "@/lib/utils/pdf-patient-extract";
import { upsertPatientClinicalProfile } from "@/features/pacientes/server/patient-clinical-profile";

async function requireTeamsJsonlImportAccess() {
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

async function findPatientByConsumerRef(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clinicId: string,
  consumerRef: string
) {
  const { data } = await supabase
    .from("patient_clinical_profiles")
    .select("patient_id")
    .eq("clinic_id", clinicId)
    .ilike("notes", `%${consumerRef}%`)
    .maybeSingle();
  return data?.patient_id ?? null;
}

async function resolvePatientForRow(
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
  const { data: profile } = await supabase
    .from("patient_clinical_profiles")
    .select("notes")
    .eq("patient_id", result.patientId)
    .eq("clinic_id", clinicId)
    .maybeSingle();
  if (!profile?.notes?.includes(row.paciente_id)) {
    const notes = profile?.notes?.trim()
      ? `${profile.notes.trim()}\n${noteLine}`
      : noteLine;
    await upsertPatientClinicalProfile(supabase, result.patientId, clinicId, {
      notes: sanitizeText(notes),
    });
  }

  return { patientId: result.patientId, created: result.created };
}

export type ImportTeamsJsonlBatchResult =
  | {
      success: true;
      fileName: string;
      recordsCreated: number;
      recordsSkipped: number;
      patientsCreated: number;
      parseErrors: string[];
      batchSize: number;
      processedThrough: number;
      totalRecords: number;
      hasMore: boolean;
      nextOffset: number;
    }
  | { success: false; fileName: string; error: string };

export async function importTeamsJsonlBatch(
  formData: FormData
): Promise<ImportTeamsJsonlBatchResult> {
  try {
    return await importTeamsJsonlBatchInner(formData);
  } catch (err) {
    console.error("[teams-jsonl-import] failed:", err);
    const fileName = String(formData.get("fileName") ?? "teams.jsonl");
    return {
      success: false,
      fileName,
      error: "La importación JSONL se interrumpió. Reintentá el lote.",
    };
  }
}

async function importTeamsJsonlBatchInner(
  formData: FormData
): Promise<ImportTeamsJsonlBatchResult> {
  const access = await requireTeamsJsonlImportAccess();
  if (access.error || !access.clinicId || !access.userId) {
    return { success: false, fileName: "", error: access.error ?? "Sin permisos" };
  }

  const fileName = String(formData.get("fileName") ?? "teams.jsonl");
  const totalRecords = Math.max(0, Number(formData.get("totalRecords") ?? 0) || 0);
  const offset = Math.max(0, Number(formData.get("offset") ?? 0) || 0);
  const payloadRaw = formData.get("payload");
  if (typeof payloadRaw !== "string" || !payloadRaw.trim()) {
    return { success: false, fileName, error: "Falta el lote de registros." };
  }

  let batch: HceExportRow[];
  try {
    batch = JSON.parse(payloadRaw) as HceExportRow[];
  } catch {
    return { success: false, fileName, error: "Lote JSON inválido." };
  }

  if (!Array.isArray(batch) || batch.length === 0) {
    return { success: false, fileName, error: "Lote vacío." };
  }
  if (batch.length > TEAMS_JSONL_IMPORT_BATCH_SIZE) {
    return {
      success: false,
      fileName,
      error: `Máximo ${TEAMS_JSONL_IMPORT_BATCH_SIZE} registros por lote.`,
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
    return { success: false, fileName, error: "No hay profesionales activos en la clínica." };
  }

  let recordsCreated = 0;
  let recordsSkipped = 0;
  let patientsCreated = 0;
  const parseErrors: string[] = [];
  const patientCache = new Map<string, string>();

  for (const row of batch) {
    let patientId = patientCache.get(row.paciente_id);
    if (!patientId) {
      const resolved = await resolvePatientForRow(
        supabase,
        access.clinicId,
        row,
        defaultInsurance,
        `Import teams JSONL: ${fileName}`
      );
      if ("error" in resolved) {
        parseErrors.push(`Registro ${row.import_record_id ?? row.lineNumber}: ${resolved.error}`);
        continue;
      }
      patientId = resolved.patientId;
      patientCache.set(row.paciente_id, patientId);
      if (resolved.created) patientsCreated += 1;
    }

    const clinical = hceRowToClinicalRecord(row);
    if (clinical) {
      const importId = row.import_record_id;
      let existingQuery = supabase
        .from("clinical_records")
        .select("id")
        .eq("clinic_id", access.clinicId)
        .eq("patient_id", patientId);

      if (importId) {
        const escaped = importId.replace(/,/g, "");
        existingQuery = existingQuery.or(
          `chief_complaint.ilike.[IMPORT:${escaped}]%,chief_complaint.ilike.[DRAPP:${escaped}]%`
        );
      } else {
        existingQuery = existingQuery.ilike("chief_complaint", `${clinical.marker}%`);
      }

      const { data: existing } = await existingQuery.maybeSingle();

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
          parseErrors.push(`Registro ${row.import_record_id ?? row.lineNumber}: ${insertError.message}`);
        } else {
          recordsCreated += 1;
        }
      }
    }
  }

  const processedThrough = offset + batch.length;
  const total = totalRecords || processedThrough;
  const hasMore = processedThrough < total;

  await logAudit({
    clinicId: access.clinicId,
    entityType: "clinical_record",
    entityId: access.clinicId,
    action: "create",
    metadata: {
      type: "teams_jsonl_import",
      fileName,
      offset,
      recordsCreated,
      patientsCreated,
      hasMore,
    },
  });

  revalidatePath("/historias");
  revalidatePath("/pacientes");

  return {
    success: true,
    fileName,
    recordsCreated,
    recordsSkipped,
    patientsCreated,
    parseErrors: parseErrors.slice(0, 25),
    batchSize: batch.length,
    processedThrough,
    totalRecords: total,
    hasMore,
    nextOffset: processedThrough,
  };
}
