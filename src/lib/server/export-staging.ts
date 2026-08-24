import type { SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

import {
  assertExportUrlAllowed,
  EXPORT_CACHE_CONTROL_NO_STORE,
  EXPORT_SIGNED_URL_TTL_SECONDS,
  EXPORT_STAGING_PATH_SEGMENT,
} from "@/core/compliance/data-export-security";
import { CLINICAL_STORAGE_BUCKET } from "@/core/compliance/storage-security";
import { sanitizeStorageFileName } from "@/core/security/file-upload";
import { assertStoragePathInClinic } from "@/core/security/tenant-scope";

const BUCKET = CLINICAL_STORAGE_BUCKET;

export function buildExportStagingPath(
  clinicId: string,
  batchId: string,
  fileName: string
): string {
  return `${clinicId}/${EXPORT_STAGING_PATH_SEGMENT}/${batchId}/${sanitizeStorageFileName(fileName, "export.zip")}`;
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
    cacheControl: EXPORT_CACHE_CONTROL_NO_STORE,
  });
  if (error) throw new Error(error.message);

  const signed = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, EXPORT_SIGNED_URL_TTL_SECONDS);
  if (signed.error || !signed.data?.signedUrl) {
    throw new Error(signed.error?.message ?? "No se pudo firmar el archivo de exportación.");
  }
  assertExportUrlAllowed(signed.data.signedUrl);
  return { storagePath, signedUrl: signed.data.signedUrl };
}

export async function signExportStagingPath(
  supabase: SupabaseClient,
  clinicId: string,
  storagePath: string
): Promise<string> {
  assertStoragePathInClinic(clinicId, storagePath);
  if (!storagePath.includes(`/${EXPORT_STAGING_PATH_SEGMENT}/`)) {
    throw new Error("Ruta de exportación inválida.");
  }
  const signed = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, EXPORT_SIGNED_URL_TTL_SECONDS);
  if (signed.error || !signed.data?.signedUrl) {
    throw new Error(signed.error?.message ?? "No se pudo firmar el archivo de exportación.");
  }
  assertExportUrlAllowed(signed.data.signedUrl);
  return signed.data.signedUrl;
}
