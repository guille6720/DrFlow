import type { SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

import { sanitizeStorageFileName } from "@/core/security/file-upload";
import { assertStoragePathInClinic } from "@/core/security/tenant-scope";

const BUCKET = "clinical-files";
const SIGNED_SECONDS = 10 * 60;

export function buildExportStagingPath(
  clinicId: string,
  batchId: string,
  fileName: string
): string {
  return `${clinicId}/export-staging/${batchId}/${sanitizeStorageFileName(fileName, "export.zip")}`;
}

export async function uploadExportStagingFile(
  supabase: SupabaseClient,
  clinicId: string,
  fileName: string,
  buffer: Buffer,
  contentType: string
): Promise<{ storagePath: string; signedUrl: string }> {
  const batchId = randomUUID();
  const storagePath = buildExportStagingPath(clinicId, batchId, fileName);
  const { error } = await supabase.storage.from(BUCKET).upload(storagePath, buffer, {
    upsert: false,
    contentType,
  });
  if (error) throw new Error(error.message);

  const signed = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, SIGNED_SECONDS);
  if (signed.error || !signed.data?.signedUrl) {
    throw new Error(signed.error?.message ?? "No se pudo firmar el archivo de exportación.");
  }
  return { storagePath, signedUrl: signed.data.signedUrl };
}

export async function signExportStagingPath(
  supabase: SupabaseClient,
  clinicId: string,
  storagePath: string
): Promise<string> {
  assertStoragePathInClinic(clinicId, storagePath);
  if (!storagePath.includes("/export-staging/")) {
    throw new Error("Ruta de exportación inválida.");
  }
  const signed = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, SIGNED_SECONDS);
  if (signed.error || !signed.data?.signedUrl) {
    throw new Error(signed.error?.message ?? "No se pudo firmar el archivo de exportación.");
  }
  return signed.data.signedUrl;
}
