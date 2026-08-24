"use server";

import { resolveImportAccess } from "@/core/actions/action-response";
import { buildExportAuditMetadata } from "@/core/compliance/data-export-security";
import { assertClinicJobEnqueueAllowed } from "@/core/entitlements/clinic-job-guard.server";
import { requireAddonFeatureAccess } from "@/core/entitlements/entitlements.server";
import { FEATURES } from "@/core/entitlements/features";
import { scheduleAfterTask } from "@/core/errors/background.server";
import { enqueueClinicJob } from "@/core/jobs/enqueue";
import { processPendingClinicJobs } from "@/core/jobs/process";
import type { ClinicJobStatus } from "@/core/jobs/registry";
import { recordAudit } from "@/core/security/audit-service";
import { requireBulkExportAccess } from "@/core/services/import-access.service";
import { createAdminClient, hasAdminClient } from "@/core/supabase/admin";
import { createClient } from "@/core/supabase/server";
import { parseEntityId } from "@/core/validations/params";

import {
  bulkExportPatientCap,
  parseBulkClinicalExportFilters,
  parseBulkClinicalExportRequest,
} from "@/features/integraciones/lib/bulk-clinical-export";
import { selectBulkExportPatients } from "@/features/integraciones/server/select-bulk-export-patients";

import { signExportStagingPath } from "@/lib/server/export-staging";

function scheduleWorker(clinicId: string) {
  scheduleAfterTask("clinic-jobs.background-process", () => processPendingClinicJobs({ limit: 5, clinicId }), {
    clinicId,
  });
}

export async function previewBulkClinicalExport(raw: unknown): Promise<{
  error?: string;
  count?: number;
  cap?: number;
  truncated?: boolean;
  format?: string;
  sections?: string[];
}> {
  const access = await requireBulkExportAccess();
  const auth = resolveImportAccess(access);
  if (!auth.ok) return { error: auth.error };

  const entitlement = await requireAddonFeatureAccess(FEATURES.DATA_EXPORT);
  if (!entitlement.ok) return { error: entitlement.error };

  const parsed = parseBulkClinicalExportFilters(raw);
  if (!parsed.ok) return { error: parsed.error };

  if (parsed.request.format === "fhir") {
    const fhir = await requireAddonFeatureAccess(FEATURES.INTEGRATIONS);
    if (!fhir.ok) return { error: fhir.error };
  }

  const cap = bulkExportPatientCap(parsed.request.format, parsed.request.sections);
  const supabase = await createClient();
  const selected = await selectBulkExportPatients(supabase, auth.clinicId, {
    scope: parsed.request.scope,
    patientIds: parsed.request.patientIds,
    professionalId: parsed.request.professionalId,
    insuranceProvider: parsed.request.insuranceProvider,
    range: parsed.request.range,
    limit: cap,
  });

  return {
    count: selected.patients.length,
    cap,
    truncated: selected.truncated,
    format: parsed.request.format,
    sections: parsed.request.sections,
  };
}

export async function enqueueBulkClinicalExport(raw: unknown): Promise<{
  error?: string;
  jobId?: string;
}> {
  const access = await requireBulkExportAccess();
  const auth = resolveImportAccess(access);
  if (!auth.ok) return { error: auth.error };

  const entitlement = await requireAddonFeatureAccess(FEATURES.DATA_EXPORT);
  if (!entitlement.ok) return { error: entitlement.error };

  const parsed = parseBulkClinicalExportRequest(raw);
  if (!parsed.ok) return { error: parsed.error };

  if (parsed.request.format === "fhir") {
    const fhir = await requireAddonFeatureAccess(FEATURES.INTEGRATIONS);
    if (!fhir.ok) return { error: fhir.error };
  }
  if (parsed.request.professionalId) {
    const professional = parseEntityId(parsed.request.professionalId, "Profesional");
    if (!professional.ok) return { error: professional.error };
  }
  for (const id of parsed.request.patientIds) {
    const patient = parseEntityId(id, "Paciente");
    if (!patient.ok) return { error: patient.error };
  }

  const supabase = await createClient();
  try {
    const guard = await assertClinicJobEnqueueAllowed({
      clinicId: auth.clinicId,
      jobType: "export_clinical_bulk",
      payload: {
        format: parsed.request.format,
      },
      supabase,
    });
    if (!guard.ok) return { error: guard.error };

    const { id } = await enqueueClinicJob(supabase, {
      clinicId: auth.clinicId,
      jobType: "export_clinical_bulk",
      payload: {
        userId: auth.userId,
        format: parsed.request.format,
        scope: parsed.request.scope,
        patientIds: parsed.request.patientIds,
        sections: parsed.request.sections,
        dateFrom: parsed.request.range.from,
        dateTo: parsed.request.range.to,
        professionalId: parsed.request.professionalId,
        insuranceProvider: parsed.request.insuranceProvider,
        confirmed: true,
      },
      createdBy: auth.userId,
    });

    await recordAudit({
      clinicId: auth.clinicId,
      module: "imports",
      entityType: "data_export",
      entityId: auth.clinicId,
      action: "export",
      what: "Encoló exportación masiva",
      metadata: buildExportAuditMetadata({
        channel: "bulk_clinical_job",
        format: parsed.request.format,
        recordCount: parsed.request.patientIds.length,
        extra: {
          type: "bulk_clinical_export",
          jobId: id,
          sections: parsed.request.sections,
          scope: parsed.request.scope,
          selectedCount: parsed.request.patientIds.length,
          dateRange: parsed.request.range,
          professionalId: parsed.request.professionalId,
          insuranceProvider: parsed.request.insuranceProvider,
        },
      }),
    });

    scheduleWorker(auth.clinicId);
    return { jobId: id };
  } catch (err) {
    const message = err instanceof Error ? err.message : "No se pudo encolar la exportación.";
    if (/job_type|check constraint/i.test(message)) {
      return { error: "Falta aplicar la migración 120 (exportación masiva) en Staging." };
    }
    return { error: message };
  }
}

export async function getBulkClinicalExportJob(jobId: string): Promise<{
  error?: string;
  status?: ClinicJobStatus;
  statusLabel?: string;
  errorMessage?: string | null;
  fileName?: string;
  patientCount?: number;
  recordCount?: number;
  warnings?: string[];
  url?: string;
}> {
  const access = await requireBulkExportAccess();
  const auth = resolveImportAccess(access);
  if (!auth.ok) return { error: auth.error };

  const parsed = parseEntityId(jobId, "Trabajo");
  if (!parsed.ok) return { error: parsed.error };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clinic_jobs")
    .select("id, job_type, status, error_message, result")
    .eq("id", parsed.data)
    .eq("clinic_id", auth.clinicId)
    .maybeSingle();

  if (error || !data) return { error: "Trabajo no encontrado." };
  if (data.job_type !== "export_clinical_bulk") return { error: "Trabajo no encontrado." };

  const result = (data.result as Record<string, unknown> | null) ?? {};
  const status = data.status as ClinicJobStatus;
  const fileName = typeof result.fileName === "string" ? result.fileName : undefined;
  const storagePath = typeof result.storagePath === "string" ? result.storagePath : undefined;

  let url: string | undefined;
  if (status === "completed" && storagePath) {
    const signer = hasAdminClient() ? createAdminClient() : supabase;
    url = await signExportStagingPath(signer, auth.clinicId, storagePath);
  }

  return {
    status,
    statusLabel:
      status === "pending"
        ? "En cola"
        : status === "running"
          ? "Procesando"
          : status === "completed"
            ? "Completado"
            : status === "failed"
              ? "Falló"
              : status,
    errorMessage: data.error_message,
    fileName,
    patientCount: typeof result.patientCount === "number" ? result.patientCount : undefined,
    recordCount: typeof result.recordCount === "number" ? result.recordCount : undefined,
    warnings: Array.isArray(result.warnings)
      ? result.warnings.filter((item): item is string => typeof item === "string").slice(0, 20)
      : undefined,
    url,
  };
}
