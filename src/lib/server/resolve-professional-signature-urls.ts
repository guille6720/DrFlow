import type { SupabaseClient } from "@supabase/supabase-js";

import {
  assertClinicalStorageUrlAllowed,
  CLINICAL_STORAGE_BUCKET,
  SIGNATURE_SIGNED_URL_TTL_SECONDS,
} from "@/core/compliance/storage-security";
import { assertStoragePathInClinic } from "@/core/security/tenant-scope";

export async function resolveProfessionalSignatureUrl(
  supabase: SupabaseClient,
  signatureImagePath: string | null | undefined,
  clinicId?: string
): Promise<string | null> {
  const path = signatureImagePath?.trim();
  if (!path) return null;

  if (clinicId) {
    try {
      assertStoragePathInClinic(clinicId, path);
    } catch {
      return null;
    }
  }

  const { data, error } = await supabase.storage
    .from(CLINICAL_STORAGE_BUCKET)
    .createSignedUrl(path, SIGNATURE_SIGNED_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) return null;
  try {
    assertClinicalStorageUrlAllowed(data.signedUrl);
  } catch {
    return null;
  }
  return data.signedUrl;
}

export async function resolveProfessionalSignatureUrls<
  T extends { signature_image_path?: string | null },
>(
  supabase: SupabaseClient,
  professionals: T[],
  clinicId?: string
): Promise<Array<T & { signature_image_url: string | null }>> {
  const uniquePaths = [
    ...new Set(
      professionals
        .map((professional) => professional.signature_image_path?.trim())
        .filter((path): path is string => {
          if (!path) return false;
          if (!clinicId) return true;
          try {
            assertStoragePathInClinic(clinicId, path);
            return true;
          } catch {
            return false;
          }
        })
    ),
  ];

  const urlByPath = new Map<string, string | null>();

  if (uniquePaths.length === 1) {
    urlByPath.set(
      uniquePaths[0],
      await resolveProfessionalSignatureUrl(supabase, uniquePaths[0], clinicId)
    );
  } else if (uniquePaths.length > 1) {
    const { data, error } = await supabase.storage
      .from(CLINICAL_STORAGE_BUCKET)
      .createSignedUrls(uniquePaths, SIGNATURE_SIGNED_URL_TTL_SECONDS);

    if (!error && data) {
      for (const item of data) {
        if (!item.path) continue;
        const url = item.signedUrl ?? null;
        if (url) {
          try {
            assertClinicalStorageUrlAllowed(url);
            urlByPath.set(item.path, url);
          } catch {
            urlByPath.set(item.path, null);
          }
        } else {
          urlByPath.set(item.path, null);
        }
      }
    }
  }

  return professionals.map((professional) => {
    const path = professional.signature_image_path?.trim();
    return {
      ...professional,
      signature_image_url: path ? (urlByPath.get(path) ?? null) : null,
    };
  });
}
