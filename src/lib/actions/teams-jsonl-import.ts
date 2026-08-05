"use server";

import { resolveImportAccess } from "@/core/actions/action-response";
import { logAudit } from "@/core/auth/session";
import { revalidateClinicalSurfaces } from "@/core/cache/revalidate-clinical";
import { withActionErrorBoundary } from "@/core/errors/action-boundary.server";
import { requireClinicalImportAccess } from "@/core/services/import-access.service";
import { createClient } from "@/core/supabase/server";
import { sanitizeText } from "@/core/validations/schemas";

import { upsertPatientClinicalProfile } from "@/features/pacientes/server/patient-clinical-profile";

import { processTeamsJsonlImportRow } from "@/lib/actions/teams-jsonl-import.helpers";
import { TEAMS_JSONL_IMPORT_BATCH_SIZE } from "@/lib/constants/clinical-documents";
import { findOrCreatePatientFromExtract, resolveImportProfessionalId } from "@/lib/utils/clinical-pdf-import";
import {
  type HceExportRow,
  placeholderDniFromConsumerId,
} from "@/lib/utils/hce-export-parse";
import type { ExtractedPatientInfo } from "@/lib/utils/pdf-patient-extract";

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
  return withActionErrorBoundary(
    "teams-jsonl-import",
    (fileName) => ({
      success: false,
      fileName: fileName || "teams.jsonl",
      error: "La importación JSONL se interrumpió. Reintentá el lote.",
    }),
    () => importTeamsJsonlBatchInner(formData),
    {
      getFileName: () => String(formData.get("fileName") ?? "teams.jsonl"),
    }
  );
}

async function importTeamsJsonlBatchInner(
  formData: FormData
): Promise<ImportTeamsJsonlBatchResult> {
  const access = await requireClinicalImportAccess();
  const auth = resolveImportAccess(access);
  if (!auth.ok) return { success: false, fileName: "", error: auth.error };

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
    .eq("id", auth.clinicId)
    .single();

  const defaultInsurance = clinic?.default_insurance_provider ?? null;
  const professionalId = await resolveImportProfessionalId(
    supabase,
    auth.clinicId,
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
    const result = await processTeamsJsonlImportRow({
      supabase,
      clinicId: auth.clinicId,
      userId: auth.userId,
      professionalId,
      row,
      patientCache,
      resolvePatient: (r) =>
        resolvePatientForRow(supabase, auth.clinicId, r, defaultInsurance, `Import teams JSONL: ${fileName}`),
    });

    patientsCreated += result.patientsCreated;
    if (result.action === "skip") {
      recordsSkipped += 1;
    } else if (result.action === "created") {
      recordsCreated += 1;
    } else if (result.action === "error") {
      parseErrors.push(result.message);
    }
  }

  const processedThrough = offset + batch.length;
  const total = totalRecords || processedThrough;
  const hasMore = processedThrough < total;

  await logAudit({
    clinicId: auth.clinicId,
    entityType: "clinical_record",
    entityId: auth.clinicId,
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

  revalidateClinicalSurfaces();

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
