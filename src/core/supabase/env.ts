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

/**
 * Fallback público si SITE_URL no está o apunta a localhost (emails / OAuth).
 * Staging/preview keep the Vercel host until nexclinic.com DNS cutover is approved.
 */
export const PUBLIC_SITE_FALLBACK = "https://drflow-app-rho.vercel.app";

/** Canonical production URL once DNS + env cutover is approved. */
export const CANONICAL_APP_URL = "https://nexclinic.com";

function isLocalhostUrl(url: string): boolean {
  return url.includes("localhost") || url.includes("127.0.0.1");
}

/** Acepta `https://dominio` o `dominio` (común en env de Vercel). */
export function normalizePublicUrl(url: string): string {
  const trimmed = url.trim().replace(/\/$/, "");
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

/** Returns false for placeholders, malformed hosts, or invalid URL syntax. */
export function isValidPublicSiteUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed || /\[SENSITIVE\]|your-project|example\.com/i.test(trimmed)) {
    return false;
  }
  try {
    const normalized = normalizePublicUrl(trimmed);
    const parsed = new URL(normalized);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    const host = parsed.hostname;
    if (!host) return false;
    if (host !== "localhost" && !host.includes(".")) return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * Prefer APP_URL (nexclinic.com cutover) then SITE_URL (staging/preview).
 * Does not force nexclinic.com while staging still points at Vercel.
 */
function readConfiguredPublicUrl(): string | undefined {
  const candidates = [
    process.env.NEXT_PUBLIC_APP_URL?.trim(),
    process.env.NEXT_PUBLIC_SITE_URL?.trim(),
    process.env.SITE_URL?.trim(),
    process.env.APP_URL?.trim(),
  ];
  for (const configured of candidates) {
    if (configured && isValidPublicSiteUrl(configured)) {
      return normalizePublicUrl(configured);
    }
  }
  return undefined;
}

/** URL pública sin barra final (Vercel / dominio propio). */
export function getSiteUrl(fallbackOrigin?: string): string {
  const configured = readConfiguredPublicUrl();
  if (configured) return configured;
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
  const configured = readConfiguredPublicUrl();
  if (configured && !isLocalhostUrl(configured)) {
    return configured;
  }

  if (fallbackOrigin) {
    const origin = fallbackOrigin.replace(/\/$/, "");
    if (!isLocalhostUrl(origin) && isValidPublicSiteUrl(origin)) return origin;
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  return PUBLIC_SITE_FALLBACK;
}
