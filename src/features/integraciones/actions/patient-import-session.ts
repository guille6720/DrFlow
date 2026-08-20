"use server";

import { revalidatePath } from "next/cache";

import { resolveImportAccess } from "@/core/actions/action-response";
import { scheduleAfterTask } from "@/core/errors/background.server";
import { enqueueClinicJob } from "@/core/jobs/enqueue";
import { processPendingClinicJobs } from "@/core/jobs/process";
import { recordAudit } from "@/core/security/audit-service";
import { validateSpreadsheetImportUpload } from "@/core/security/file-upload";
import { requirePatientImportAccess } from "@/core/services/import-access.service";
import { createClient } from "@/core/supabase/server";
import { parseEntityId } from "@/core/validations/params";

import {
  defaultDuplicateDecisions,
  type DuplicateDecisionSet,
} from "@/features/integraciones/lib/patient-import-duplicates";
import {
  type ImportTemplateCandidate,
  type PatientColumnMapping,
  pickCompatibleTemplate,
  remapTemplateToHeaders,
  suggestPatientColumnMapping,
  suggestPresetFromHeaders,
} from "@/features/integraciones/lib/patient-import-mapping";
import { parsePatientSpreadsheet } from "@/features/integraciones/lib/patient-import-spreadsheet";
import { isMappingComplete, mappingMissingFields } from "@/features/integraciones/lib/patient-import-validate";
import { toCsvDocument } from "@/features/integraciones/lib/spreadsheet-export-safety";
import type { DataImportSessionRow } from "@/features/integraciones/server/data-import-types";
import { preparePatientImportFromBuffer } from "@/features/integraciones/server/prepare-patient-import";

import { CONSUMERS_IMPORT_MAX_BYTES } from "@/lib/constants/clinical-documents";
import { downloadImportStagingFile, uploadImportStagingFile } from "@/lib/server/import-staging";

function scheduleWorker(clinicId: string) {
  scheduleAfterTask("import-jobs.worker", () => processPendingClinicJobs({ limit: 10, clinicId }), {
    clinicId,
  });
}

function asSession(row: Record<string, unknown>): DataImportSessionRow {
  return row as unknown as DataImportSessionRow;
}

async function loadOwnedSession(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clinicId: string,
  sessionId: string
) {
  const { data, error } = await supabase
    .from("data_import_sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("clinic_id", clinicId)
    .maybeSingle();
  if (error || !data) return null;
  return asSession(data);
}

export async function createPatientImportSession(formData: FormData): Promise<{
  error?: string;
  session?: DataImportSessionRow;
  suggestedPreset?: string;
  suggestedTemplateName?: string;
}> {
  const access = await requirePatientImportAccess();
  const auth = resolveImportAccess(access);
  if (!auth.ok) return { error: auth.error };

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { error: "Archivo inválido. Usá .xlsx o .csv (máx. 15 MB)." };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const validated = validateSpreadsheetImportUpload(file, buffer, CONSUMERS_IMPORT_MAX_BYTES);
  if (!validated.ok) return { error: validated.error };

  let table;
  try {
    table = await parsePatientSpreadsheet(buffer, file.name);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo leer la planilla." };
  }

  const supabase = await createClient();
  const { data: templateRows } = await supabase
    .from("import_mapping_templates")
    .select("id, name, mapping, date_format, last_used_at")
    .eq("clinic_id", auth.clinicId)
    .eq("import_type", "patients")
    .order("last_used_at", { ascending: false, nullsFirst: false });

  const matched = pickCompatibleTemplate(
    (templateRows ?? []) as ImportTemplateCandidate[],
    table.headers
  );
  const mapping = matched
    ? remapTemplateToHeaders(matched.mapping, table.headers)
    : suggestPatientColumnMapping(table.headers);
  const dateFormat = matched?.date_format ?? "dmy";

  if (matched) {
    await supabase
      .from("import_mapping_templates")
      .update({ last_used_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", matched.id)
      .eq("clinic_id", auth.clinicId);
  }

  const { storagePath } = await uploadImportStagingFile(supabase, auth.clinicId, file.name, buffer);

  const { data, error } = await supabase
    .from("data_import_sessions")
    .insert({
      clinic_id: auth.clinicId,
      created_by: auth.userId,
      import_type: "patients",
      original_filename: file.name,
      storage_path: storagePath,
      status: "parsing",
      column_mapping: mapping,
      date_format: dateFormat,
      template_id: matched?.id ?? null,
      headers: table.headers,
      preview_rows: table.rows.slice(0, 8),
      stats: { total: table.rows.length, ready: 0, duplicates: 0, invalid: 0 },
      duplicate_decisions: defaultDuplicateDecisions(),
    })
    .select("*")
    .single();

  if (error || !data) {
    return { error: error?.message ?? "No se pudo crear la sesión de importación." };
  }

  await recordAudit({
    clinicId: auth.clinicId,
    module: "imports",
    entityType: "data_import_session",
    entityId: data.id,
    action: "create",
    what: "Subió archivo de importación de pacientes",
    metadata: {
      fileName: file.name,
      rowCount: table.rows.length,
      status: "parsing",
    },
  });

  return {
    session: asSession(data),
    suggestedPreset: suggestPresetFromHeaders(table.headers),
    suggestedTemplateName: matched?.name,
  };
}

export async function savePatientImportMapping(
  sessionIdRaw: string,
  mapping: PatientColumnMapping,
  dateFormat?: string | null
): Promise<{ error?: string; session?: DataImportSessionRow }> {
  const access = await requirePatientImportAccess();
  const auth = resolveImportAccess(access);
  if (!auth.ok) return { error: auth.error };

  const parsed = parseEntityId(sessionIdRaw, "Sesión");
  if (!parsed.ok) return { error: parsed.error };
  if (!isMappingComplete(mapping)) {
    return {
      error: `Faltan columnas obligatorias: ${mappingMissingFields(mapping).join(", ")}.`,
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("data_import_sessions")
    .update({
      column_mapping: mapping,
      date_format: dateFormat ?? null,
      status: "parsing",
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.data)
    .eq("clinic_id", auth.clinicId)
    .select("*")
    .single();

  if (error || !data) return { error: "No se pudo guardar el mapeo." };
  return { session: asSession(data) };
}

export async function validatePatientImportSession(sessionIdRaw: string): Promise<{
  error?: string;
  session?: DataImportSessionRow;
}> {
  const access = await requirePatientImportAccess();
  const auth = resolveImportAccess(access);
  if (!auth.ok) return { error: auth.error };

  const parsed = parseEntityId(sessionIdRaw, "Sesión");
  if (!parsed.ok) return { error: parsed.error };

  const supabase = await createClient();
  const session = await loadOwnedSession(supabase, auth.clinicId, parsed.data);
  if (!session) return { error: "Sesión no encontrada." };
  if (!isMappingComplete(session.column_mapping)) {
    return { error: "Completá el mapeo de DNI, apellido y nombre." };
  }

  const buffer = await downloadImportStagingFile(supabase, session.storage_path);
  const prepared = await preparePatientImportFromBuffer(
    supabase,
    auth.clinicId,
    buffer,
    session.original_filename,
    session.column_mapping,
    session.date_format
  );

  const { data, error } = await supabase
    .from("data_import_sessions")
    .update({
      status: "ready",
      stats: prepared.stats,
      invalid_sample: prepared.issues,
      duplicate_sample: prepared.duplicates,
      error_summary: prepared.issues.slice(0, 8).map((item) => item.message).join(" · ") || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", session.id)
    .eq("clinic_id", auth.clinicId)
    .select("*")
    .single();

  if (error || !data) return { error: "No se pudo validar el archivo." };
  return { session: asSession(data) };
}

export async function savePatientImportDecisions(
  sessionIdRaw: string,
  decisions: DuplicateDecisionSet
): Promise<{ error?: string; session?: DataImportSessionRow }> {
  const access = await requirePatientImportAccess();
  const auth = resolveImportAccess(access);
  if (!auth.ok) return { error: auth.error };
  const parsed = parseEntityId(sessionIdRaw, "Sesión");
  if (!parsed.ok) return { error: parsed.error };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("data_import_sessions")
    .update({
      duplicate_decisions: decisions,
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.data)
    .eq("clinic_id", auth.clinicId)
    .select("*")
    .single();

  if (error || !data) return { error: "No se pudieron guardar las decisiones." };
  return { session: asSession(data) };
}

export async function confirmPatientImportSession(sessionIdRaw: string): Promise<{
  error?: string;
  jobId?: string;
  session?: DataImportSessionRow;
}> {
  const access = await requirePatientImportAccess();
  const auth = resolveImportAccess(access);
  if (!auth.ok) return { error: auth.error };
  const parsed = parseEntityId(sessionIdRaw, "Sesión");
  if (!parsed.ok) return { error: parsed.error };

  const supabase = await createClient();
  const session = await loadOwnedSession(supabase, auth.clinicId, parsed.data);
  if (!session) return { error: "Sesión no encontrada." };
  if (session.status !== "ready") {
    return { error: "Validá el archivo antes de importar." };
  }

  const { id } = await enqueueClinicJob(supabase, {
    clinicId: auth.clinicId,
    jobType: "import_patients_batch",
    payload: {
      storagePath: session.storage_path,
      fileName: session.original_filename,
      offset: 0,
      batchSize: 80,
      importKind: "patients_mapped",
      userId: auth.userId,
      sessionId: session.id,
      mapping: session.column_mapping,
      decisions: session.duplicate_decisions,
      dateFormat: session.date_format,
    },
    createdBy: auth.userId,
  });

  const { data } = await supabase
    .from("data_import_sessions")
    .update({
      status: "importing",
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", session.id)
    .eq("clinic_id", auth.clinicId)
    .select("*")
    .single();

  await recordAudit({
    clinicId: auth.clinicId,
    module: "imports",
    entityType: "data_import_session",
    entityId: session.id,
    action: "create",
    what: "Confirmó importación de pacientes",
    metadata: {
      fileName: session.original_filename,
      jobId: id,
      stats: session.stats,
    },
  });

  scheduleWorker(auth.clinicId);
  revalidatePath("/datos");
  revalidatePath("/configuracion");

  return { jobId: id, session: data ? asSession(data) : session };
}

export async function getPatientImportSession(sessionIdRaw: string): Promise<{
  error?: string;
  session?: DataImportSessionRow;
}> {
  const access = await requirePatientImportAccess();
  const auth = resolveImportAccess(access);
  if (!auth.ok) return { error: auth.error };
  const parsed = parseEntityId(sessionIdRaw, "Sesión");
  if (!parsed.ok) return { error: parsed.error };
  const supabase = await createClient();
  const session = await loadOwnedSession(supabase, auth.clinicId, parsed.data);
  if (!session) return { error: "Sesión no encontrada." };
  return { session };
}

export async function downloadPatientImportErrorCsv(sessionIdRaw: string): Promise<{
  error?: string;
  csv?: string;
  fileName?: string;
}> {
  const access = await requirePatientImportAccess();
  const auth = resolveImportAccess(access);
  if (!auth.ok) return { error: auth.error };
  const parsed = parseEntityId(sessionIdRaw, "Sesión");
  if (!parsed.ok) return { error: parsed.error };

  const supabase = await createClient();
  const session = await loadOwnedSession(supabase, auth.clinicId, parsed.data);
  if (!session) return { error: "Sesión no encontrada." };

  const rows = [
    ["linea", "codigo", "error"],
    ...session.invalid_sample.map((issue) => [
      String(issue.lineNumber),
      issue.code,
      issue.message,
    ]),
  ];

  return {
    csv: toCsvDocument(rows),
    fileName: `errores-importacion-${session.id.slice(0, 8)}.csv`,
  };
}

export async function listImportMappingTemplates(): Promise<{
  error?: string;
  templates?: Array<{ id: string; name: string; mapping: PatientColumnMapping; date_format: string | null }>;
}> {
  const access = await requirePatientImportAccess();
  const auth = resolveImportAccess(access);
  if (!auth.ok) return { error: auth.error };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("import_mapping_templates")
    .select("id, name, mapping, date_format")
    .eq("clinic_id", auth.clinicId)
    .eq("import_type", "patients")
    .order("last_used_at", { ascending: false, nullsFirst: false });
  if (error) return { error: "No se pudieron cargar las plantillas." };
  return {
    templates: (data ?? []).map((row) => ({
      ...row,
      mapping: row.mapping as unknown as PatientColumnMapping,
    })),
  };
}

export async function saveImportMappingTemplate(
  name: string,
  mapping: PatientColumnMapping,
  dateFormat?: string | null
): Promise<{ error?: string }> {
  const access = await requirePatientImportAccess();
  const auth = resolveImportAccess(access);
  if (!auth.ok) return { error: auth.error };
  const trimmed = name.trim().slice(0, 80);
  if (trimmed.length < 2) return { error: "Ingresá un nombre de plantilla." };
  if (!isMappingComplete(mapping)) return { error: "La plantilla necesita DNI, apellido y nombre." };

  const supabase = await createClient();
  const { error } = await supabase.from("import_mapping_templates").upsert(
    {
      clinic_id: auth.clinicId,
      name: trimmed,
      import_type: "patients",
      mapping,
      date_format: dateFormat ?? null,
      created_by: auth.userId,
      last_used_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "clinic_id,import_type,name" }
  );
  if (error) return { error: "No se pudo guardar la plantilla." };
  return {};
}
