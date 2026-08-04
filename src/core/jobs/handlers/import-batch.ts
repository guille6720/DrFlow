import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { assertStoragePathInClinic } from "@/core/security/tenant-scope";
import { HCE_IMPORT_BATCH_SIZE } from "@/lib/constants/clinical-documents";
import { processHceImportBatchFromContent } from "@/features/integraciones/server/hce-import-batch";
import { processConsumersImportBatchFromBuffer } from "@/features/pacientes/server/consumers-import-batch";
import { enqueueClinicJob } from "@/core/jobs/enqueue";
import {
  downloadImportStagingFile,
  removeImportStagingFile,
} from "@/lib/server/import-staging";
import type { ClinicJobRow, ImportBatchJobPayload } from "@/core/jobs/types";

const PATIENTS_BATCH_SIZE = 80;

async function chainNextBatch(
  supabase: SupabaseClient,
  job: ClinicJobRow,
  payload: ImportBatchJobPayload & { userId: string; fileName: string },
  nextOffset: number
) {
  await enqueueClinicJob(supabase, {
    clinicId: job.clinic_id,
    jobType: job.job_type,
    payload: {
      ...payload,
      offset: nextOffset,
    },
    createdBy: payload.userId,
  });
}

export async function handleImportBatchJob(
  supabase: SupabaseClient,
  job: ClinicJobRow
): Promise<Record<string, unknown>> {
  const payload = job.payload as unknown as ImportBatchJobPayload & {
    userId: string;
    storagePath: string;
    fileName: string;
  };

  assertStoragePathInClinic(job.clinic_id, payload.storagePath);

  const buffer = await downloadImportStagingFile(supabase, payload.storagePath);

  if (payload.importKind === "hce" || job.job_type === "import_hce_batch") {
    const content = buffer.toString("utf-8");
    const result = await processHceImportBatchFromContent(supabase, {
      clinicId: job.clinic_id,
      userId: payload.userId,
      content,
      originalName: payload.fileName,
      offset: payload.offset,
    });

    if (!result.success) {
      throw new Error(result.error);
    }

    if (result.hasMore) {
      await chainNextBatch(supabase, job, payload, result.nextOffset);
    } else {
      await removeImportStagingFile(supabase, payload.storagePath);
    }

    revalidatePath("/historias");
    revalidatePath("/pacientes");
    revalidatePath("/datos");

    return result as unknown as Record<string, unknown>;
  }

  if (payload.importKind === "patients" || job.job_type === "import_patients_batch") {
    const batchSize = payload.batchSize || PATIENTS_BATCH_SIZE;
    const result = await processConsumersImportBatchFromBuffer(supabase, {
      clinicId: job.clinic_id,
      userId: payload.userId,
      buffer,
      originalName: payload.fileName,
      offset: payload.offset,
      limit: batchSize,
    });

    if (!result.success) {
      throw new Error(result.error);
    }

    if (result.hasMore) {
      await chainNextBatch(supabase, job, payload, result.nextOffset);
    } else {
      await removeImportStagingFile(supabase, payload.storagePath);
    }

    revalidatePath("/pacientes");
    revalidatePath("/datos");

    return result as unknown as Record<string, unknown>;
  }

  return {
    skipped: true,
    importKind: payload.importKind,
    message: "Tipo de importación no soportado aún.",
  };
}

export { HCE_IMPORT_BATCH_SIZE, PATIENTS_BATCH_SIZE };
