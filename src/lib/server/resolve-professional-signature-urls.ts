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
  return Promise.all(
    professionals.map(async (professional) => ({
      ...professional,
      signature_image_url: await resolveProfessionalSignatureUrl(
        supabase,
        professional.signature_image_path
      ),
    }))
  );
}
