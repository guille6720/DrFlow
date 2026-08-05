import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { revalidateClinicalSurfaces } from "@/core/cache/revalidate-clinical";
import { assertStoragePathInClinic } from "@/core/security/tenant-scope";
import {
  downloadImportStagingFile,
  removeImportStagingFile,
} from "@/lib/server/import-staging";
import { processClinicalPdfImport } from "@/lib/server/process-clinical-pdf-import";
import type { ClinicJobRow, ImportClinicalPdfJobPayload } from "@/core/jobs/types";

export async function handleImportClinicalPdfJob(
  supabase: SupabaseClient,
  job: ClinicJobRow
): Promise<Record<string, unknown>> {
  const payload = job.payload as unknown as ImportClinicalPdfJobPayload & {
    userId: string;
    fileSize: number;
  };

  assertStoragePathInClinic(job.clinic_id, payload.storagePath);

  const buffer = await downloadImportStagingFile(supabase, payload.storagePath);

  const result = await processClinicalPdfImport(supabase, {
    clinicId: job.clinic_id,
    userId: payload.userId,
    buffer,
    originalName: payload.fileName,
    fileSize: payload.fileSize,
  });

  if (result.success) {
    await removeImportStagingFile(supabase, payload.storagePath);
    revalidateClinicalSurfaces();
    revalidatePath(`/pacientes/${result.patientId}`);
  }

  return result as unknown as Record<string, unknown>;
}
