"use server";

import { revalidatePath } from "next/cache";

import { resolveImportAccess } from "@/core/actions/action-response";
import { revalidateClinicalSurfaces } from "@/core/cache/revalidate-clinical";
import { requireAddonFeatureAccess } from "@/core/entitlements/entitlements.server";
import { FEATURES } from "@/core/entitlements/features";
import { recordAudit } from "@/core/security/audit-service";
import { validateJsonImportUpload } from "@/core/security/file-upload";
import { requireClinicalImportAccess } from "@/core/services/import-access.service";
import { DATA_IMPORT_SESSION_COLUMNS } from "@/core/supabase/select-columns";
import { createClient } from "@/core/supabase/server";
import { parseEntityId } from "@/core/validations/params";

import type { DuplicateDecisionSet } from "@/features/integraciones/lib/patient-import-duplicates";
import { applyFhirImportDraft } from "@/features/integraciones/server/apply-fhir-import";
import {
  attachFhirDuplicates,
  prepareFhirImportFromText,
} from "@/features/integraciones/server/prepare-fhir-import";

import { FHIR_IMPORT_MAX_BYTES } from "@/lib/constants/clinical-documents";
import { downloadImportStagingFile, uploadImportStagingFile } from "@/lib/server/import-staging";

export type FhirImportPreview = {
  sessionId: string;
  fileName: string;
  stats: {
    patients: number;
    encounters: number;
    resources: number;
    duplicates: number;
    invalid: number;
  };
  warnings: string[];
  issues: string[];
  duplicates: Array<{
    lineNumber: number;
    matchType: string;
    incoming: string;
    existing: string;
  }>;
};

export async function createFhirImportSession(formData: FormData): Promise<{
  error?: string;
  preview?: FhirImportPreview;
}> {
  const access = await requireClinicalImportAccess();
  const auth = resolveImportAccess(access);
  if (!auth.ok) return { error: auth.error };

  const entitlement = await requireAddonFeatureAccess(FEATURES.INTEGRATIONS);
  if (!entitlement.ok) return { error: entitlement.error };

  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "Seleccioná un JSON FHIR R4." };

  const buffer = Buffer.from(await file.arrayBuffer());
  const validated = validateJsonImportUpload(file, buffer, FHIR_IMPORT_MAX_BYTES);
  if (!validated.ok) return { error: validated.error };

  const prepared = prepareFhirImportFromText(buffer.toString("utf8"));
  if (!prepared.ok) return { error: prepared.error };

  const supabase = await createClient();
  const withDupes = await attachFhirDuplicates(supabase, auth.clinicId, prepared.prepared);
  const { storagePath } = await uploadImportStagingFile(supabase, auth.clinicId, file.name, buffer);

  const { data, error } = await supabase
    .from("data_import_sessions")
    .insert({
      clinic_id: auth.clinicId,
      created_by: auth.userId,
      import_type: "fhir",
      original_filename: file.name,
      storage_path: storagePath,
      status: "ready",
      headers: Object.keys(withDupes.draft.resourceCounts),
      preview_rows: withDupes.draft.patients.slice(0, 8).map((item) => ({
        dni: item.demographics.document_number ?? "",
        apellido: item.demographics.last_name,
        nombre: item.demographics.first_name,
        encuentros: String(item.encounters.length),
      })),
      stats: withDupes.stats,
      duplicate_sample: withDupes.duplicates.slice(0, 80),
      error_summary: withDupes.draft.issues.slice(0, 6).join(" · ") || null,
    })
    .select(DATA_IMPORT_SESSION_COLUMNS)
    .single();

  if (error || !data) return { error: error?.message ?? "No se pudo crear la sesión FHIR." };

  await recordAudit({
    clinicId: auth.clinicId,
    module: "imports",
    entityType: "data_import_session",
    entityId: data.id,
    action: "create",
    what: "Subió Bundle FHIR R4",
    metadata: {
      type: "fhir_import",
      fileName: file.name,
      stats: withDupes.stats,
    },
  });

  return {
    preview: {
      sessionId: data.id,
      fileName: file.name,
      stats: withDupes.stats,
      warnings: withDupes.draft.warnings.slice(0, 20),
      issues: withDupes.draft.issues.slice(0, 20),
      duplicates: withDupes.duplicates.slice(0, 20).map((item) => ({
        lineNumber: item.lineNumber,
        matchType: item.matchType,
        incoming: `${item.incoming.last_name}, ${item.incoming.first_name} (${item.incoming.document_number})`,
        existing: `${item.existing.last_name}, ${item.existing.first_name} (${item.existing.document_number})`,
      })),
    },
  };
}

export async function confirmFhirImportSession(
  sessionIdRaw: string,
  decisions?: DuplicateDecisionSet
): Promise<{ error?: string; result?: Awaited<ReturnType<typeof applyFhirImportDraft>> }> {
  const access = await requireClinicalImportAccess();
  const auth = resolveImportAccess(access);
  if (!auth.ok) return { error: auth.error };

  const entitlement = await requireAddonFeatureAccess(FEATURES.INTEGRATIONS);
  if (!entitlement.ok) return { error: entitlement.error };

  const parsed = parseEntityId(sessionIdRaw, "Sesión");
  if (!parsed.ok) return { error: parsed.error };

  const supabase = await createClient();
  const { data: session } = await supabase
    .from("data_import_sessions")
    .select(DATA_IMPORT_SESSION_COLUMNS)
    .eq("id", parsed.data)
    .eq("clinic_id", auth.clinicId)
    .maybeSingle();
  if (!session) return { error: "Sesión no encontrada." };
  if (session.import_type !== "fhir") return { error: "La sesión no es una importación FHIR." };
  if (session.status !== "ready") return { error: "Validá el Bundle antes de importar." };

  const buffer = await downloadImportStagingFile(supabase, session.storage_path);
  const prepared = prepareFhirImportFromText(buffer.toString("utf8"));
  if (!prepared.ok) return { error: prepared.error };
  const withDupes = await attachFhirDuplicates(supabase, auth.clinicId, prepared.prepared);

  const existingByDocument = new Map<string, string>();
  const existingByNameDob = new Map<string, string>();
  for (const item of withDupes.duplicates) {
    if (item.matchType === "document") existingByDocument.set(item.incoming.document_number ?? "", item.existing.id);
    if (item.matchType === "name_dob" && item.incoming.birth_date) {
      existingByNameDob.set(
        `${item.incoming.last_name.toLowerCase()}|${item.incoming.first_name.toLowerCase()}|${item.incoming.birth_date}`,
        item.existing.id
      );
    }
  }

  const byLine = new Map<number, "document" | "name_dob">();
  for (const item of withDupes.duplicates) byLine.set(item.lineNumber, item.matchType);

  await supabase
    .from("data_import_sessions")
    .update({
      status: "importing",
      started_at: new Date().toISOString(),
      duplicate_decisions: decisions ?? session.duplicate_decisions,
      updated_at: new Date().toISOString(),
    })
    .eq("id", session.id)
    .eq("clinic_id", auth.clinicId);

  const applied = await applyFhirImportDraft(supabase, {
    clinicId: auth.clinicId,
    userId: auth.userId,
    draft: withDupes.draft,
    decisions,
    duplicatesByLine: byLine,
    existingByDocument,
    existingByNameDob,
  });

  await supabase
    .from("data_import_sessions")
    .update({
      status: applied.patientsSkipped && !applied.patientsCreated && !applied.recordsCreated
        ? "completed_with_warnings"
        : "completed",
      imported_count: applied.patientsCreated + applied.recordsCreated,
      skipped_count: applied.patientsSkipped + applied.recordsSkipped,
      completed_at: new Date().toISOString(),
      error_summary: applied.warnings.slice(0, 8).join(" · ") || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", session.id)
    .eq("clinic_id", auth.clinicId);

  await recordAudit({
    clinicId: auth.clinicId,
    module: "imports",
    entityType: "data_import_session",
    entityId: session.id,
    action: "create",
    what: "Confirmó importación FHIR R4",
    metadata: {
      type: "fhir_import",
      fileName: session.original_filename,
      ...applied,
    },
  });

  revalidateClinicalSurfaces();
  revalidatePath("/datos");
  revalidatePath("/pacientes");

  return { result: applied };
}
