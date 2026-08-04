/**
 * Supabase soporta claves legacy (anon) y nuevas (publishable sb_publishable_...).
 * @see https://supabase.com/docs/guides/api/api-keys
 */
export function getSupabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    throw new Error("Falta NEXT_PUBLIC_SUPABASE_URL en .env.local");
  }
  return url;
}

export function getSupabaseAnonKey(): string {
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!key || key.includes("placeholder")) {
    throw new Error(
      "Falta NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY o NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local"
    );
  }
  return key;
}

/** Fallback público si SITE_URL no está o apunta a localhost (emails / OAuth). */
export const PUBLIC_SITE_FALLBACK = "https://drflow-app-rho.vercel.app";

function isLocalhostUrl(url: string): boolean {
  return url.includes("localhost") || url.includes("127.0.0.1");
}

/** Acepta `https://dominio` o `dominio` (común en env de Vercel). */
function normalizePublicUrl(url: string): string {
  const trimmed = url.trim().replace(/\/$/, "");
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

/** URL pública sin barra final (Vercel / dominio propio). */
export function getSiteUrl(fallbackOrigin?: string): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return normalizePublicUrl(configured);
  if (fallbackOrigin) return fallbackOrigin.replace(/\/$/, "");
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return "http://localhost:3000";
}

/**
 * URL segura para emails de recovery y OAuth (cliente o servidor).
 * En el navegador, pasá `window.location.origin` como fallbackOrigin en dev local.
 */
export function getPublicSiteUrl(fallbackOrigin?: string): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured && !isLocalhostUrl(configured)) {
    return normalizePublicUrl(configured);
  }

  if (fallbackOrigin) {
    const origin = fallbackOrigin.replace(/\/$/, "");
    if (!isLocalhostUrl(origin)) return origin;
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  return PUBLIC_SITE_FALLBACK;
}
