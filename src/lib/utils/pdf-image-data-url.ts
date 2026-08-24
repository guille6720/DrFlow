import { isSafeOutboundUrl } from "@/core/security/ssrf";
import { getSupabaseUrl } from "@/core/supabase/env";

function supabaseStorageHostAllowlist(): string[] {
  try {
    return [new URL(getSupabaseUrl()).hostname];
  } catch {
    return [];
  }
}

/** Converts a remote or data-URL image into a data URL suitable for jsPDF. */
export async function resolvePdfImageDataUrl(
  imageUrl: string | null | undefined
): Promise<string | null> {
  const url = imageUrl?.trim();
  if (!url) return null;
  if (url.startsWith("data:image/")) return url;

  if (
    !isSafeOutboundUrl(url, {
      allowedHostnames: supabaseStorageHostAllowlist(),
      allowedHostnameSuffixes: ["supabase.co"],
    })
  ) {
    return null;
  }

  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}
