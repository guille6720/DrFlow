import type { SupabaseClient } from "@supabase/supabase-js";

import type { ClinicJobRow, ExportClinicalBulkJobPayload } from "@/core/jobs/types";

import { parseBulkClinicalExportRequest } from "@/features/integraciones/lib/bulk-clinical-export";
import { buildBulkClinicalExport } from "@/features/integraciones/server/build-bulk-clinical-export";

import { uploadExportStagingFile } from "@/lib/server/export-staging";

export async function handleExportClinicalBulkJob(
  supabase: SupabaseClient,
  job: ClinicJobRow
): Promise<Record<string, unknown>> {
  const payload = job.payload as unknown as ExportClinicalBulkJobPayload;
  const parsed = parseBulkClinicalExportRequest({
    ...payload,
    confirmed: true,
  });
  if (!parsed.ok) throw new Error(parsed.error);

  const built = await buildBulkClinicalExport(supabase, job.clinic_id, parsed.request);
  const uploaded = await uploadExportStagingFile(
    supabase,
    job.clinic_id,
    built.fileName,
    built.buffer,
    built.mime
  );

  return {
    storagePath: uploaded.storagePath,
    fileName: built.fileName,
    mime: built.mime,
    patientCount: built.patientCount,
    recordCount: built.recordCount,
    warnings: built.warnings.slice(0, 40),
    truncated: built.truncated,
  };
}
