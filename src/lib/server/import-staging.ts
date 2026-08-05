import type { SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

import { scheduleFireAndForget } from "@/core/errors/background.server";
import { sanitizeStorageFileName } from "@/core/security/file-upload";

const BUCKET = "clinical-files";

function sanitizeStagingName(name: string): string {
  return sanitizeStorageFileName(name, "import");
}

export function buildImportStagingPath(
  clinicId: string,
  batchId: string,
  fileName: string
): string {
  return `${clinicId}/import-staging/${batchId}/${sanitizeStagingName(fileName)}`;
}

export async function uploadImportStagingFile(
  supabase: SupabaseClient,
  clinicId: string,
  fileName: string,
  buffer: Buffer
): Promise<{ storagePath: string; batchId: string }> {
  const batchId = randomUUID();
  const storagePath = buildImportStagingPath(clinicId, batchId, fileName);

  const { error } = await supabase.storage.from(BUCKET).upload(storagePath, buffer, {
    upsert: false,
    contentType: "application/octet-stream",
  });

  if (error) {
    throw new Error(error.message);
  }

  return { storagePath, batchId };
}

export async function downloadImportStagingFile(
  supabase: SupabaseClient,
  storagePath: string
): Promise<Buffer> {
  const { data, error } = await supabase.storage.from(BUCKET).download(storagePath);
  if (error || !data) {
    throw new Error(error?.message ?? "No se pudo leer el archivo de importación");
  }
  return Buffer.from(await data.arrayBuffer());
}

export async function removeImportStagingFile(
  supabase: SupabaseClient,
  storagePath: string
): Promise<void> {
  await supabase.storage.from(BUCKET).remove([storagePath]);
}

export function triggerImportJobsProcessing(clinicId: string): void {
  scheduleFireAndForget(
    "import-staging.worker",
    import("@/core/jobs/process").then(({ processPendingClinicJobs }) =>
      processPendingClinicJobs({ limit: 10, clinicId })
    ),
    { clinicId }
  );
}
