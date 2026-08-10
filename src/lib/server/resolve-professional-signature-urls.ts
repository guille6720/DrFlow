import type { SupabaseClient } from "@supabase/supabase-js";

const SIGNATURE_URL_TTL_SECONDS = 3600;

export async function resolveProfessionalSignatureUrl(
  supabase: SupabaseClient,
  signatureImagePath: string | null | undefined
): Promise<string | null> {
  const path = signatureImagePath?.trim();
  if (!path) return null;

  const { data, error } = await supabase.storage
    .from("clinical-files")
    .createSignedUrl(path, SIGNATURE_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

export async function resolveProfessionalSignatureUrls<T extends { signature_image_path?: string | null }>(
  supabase: SupabaseClient,
  professionals: T[]
): Promise<Array<T & { signature_image_url: string | null }>> {
  const uniquePaths = [
    ...new Set(
      professionals
        .map((professional) => professional.signature_image_path?.trim())
        .filter((path): path is string => Boolean(path))
    ),
  ];

  const urlByPath = new Map<string, string | null>();

  if (uniquePaths.length === 1) {
    urlByPath.set(
      uniquePaths[0],
      await resolveProfessionalSignatureUrl(supabase, uniquePaths[0])
    );
  } else if (uniquePaths.length > 1) {
    const { data, error } = await supabase.storage
      .from("clinical-files")
      .createSignedUrls(uniquePaths, SIGNATURE_URL_TTL_SECONDS);

    if (!error && data) {
      for (const item of data) {
        if (!item.path) continue;
        urlByPath.set(item.path, item.signedUrl ?? null);
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
