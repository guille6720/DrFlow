import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

import { revalidateClinicalSurfaces } from "@/core/cache/revalidate-clinical";
import { enqueueClinicJob } from "@/core/jobs/enqueue";
import type { ClinicJobRow, ImportBatchJobPayload } from "@/core/jobs/types";
import { assertStoragePathInClinic } from "@/core/security/tenant-scope";

import { processHceImportBatchFromContent } from "@/features/integraciones/server/hce-import-batch";
import { processMappedPatientImportBatch } from "@/features/integraciones/server/mapped-patient-import-batch";
import { processConsumersImportBatchFromBuffer } from "@/features/pacientes/server/consumers-import-batch";

import { HCE_IMPORT_BATCH_SIZE } from "@/lib/constants/clinical-documents";
import {
  downloadImportStagingFile,
  removeImportStagingFile,
} from "@/lib/server/import-staging";

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

    revalidateClinicalSurfaces();
    revalidatePath("/datos");

    return result as unknown as Record<string, unknown>;
  }

  if (
    payload.importKind === "patients_mapped" ||
    (payload.sessionId && (payload.importKind === "patients" || job.job_type === "import_patients_batch"))
  ) {
    const batchSize = payload.batchSize || PATIENTS_BATCH_SIZE;
    const result = await processMappedPatientImportBatch(supabase, {
      clinicId: job.clinic_id,
      userId: payload.userId,
      buffer,
      originalName: payload.fileName,
      mapping: (payload.mapping ?? {}) as import("@/features/integraciones/lib/patient-import-mapping").PatientColumnMapping,
      decisions: (payload.decisions ?? {
        exactDefault: "keep",
        possibleDefault: "review",
        byLine: {},
      }) as import("@/features/integraciones/lib/patient-import-duplicates").DuplicateDecisionSet,
      dateFormat: payload.dateFormat,
      offset: payload.offset,
      limit: batchSize,
    });

    if (!result.success) {
      if (payload.sessionId) {
        await supabase
          .from("data_import_sessions")
          .update({
            status: "failed",
            error_summary: result.error,
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", payload.sessionId)
          .eq("clinic_id", job.clinic_id);
      }
      throw new Error(result.error);
    }

    if (payload.sessionId) {
      const { data: session } = await supabase
        .from("data_import_sessions")
        .select("imported_count, skipped_count, failed_count")
        .eq("id", payload.sessionId)
        .eq("clinic_id", job.clinic_id)
        .maybeSingle();

      const imported = (session?.imported_count ?? 0) + result.patientsCreated + result.patientsUpdated;
      const skipped = (session?.skipped_count ?? 0) + result.patientsSkipped;
      const failed = (session?.failed_count ?? 0) + result.patientsFailed;
      const doneStatus =
        failed > 0 || result.parseErrors.length > 0 ? "completed_with_warnings" : "completed";

      await supabase
        .from("data_import_sessions")
        .update({
          imported_count: imported,
          skipped_count: skipped,
          failed_count: failed,
          status: result.hasMore ? "importing" : doneStatus,
          completed_at: result.hasMore ? null : new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", payload.sessionId)
        .eq("clinic_id", job.clinic_id);
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
