/**
 * RCTA public configuration (phase 1: external link only).
 *
 * `NEXT_PUBLIC_RCTA_URL` is a PUBLIC value (the RCTA web app URL). It is not a secret.
 * Future official RCTA API credentials must NEVER use a `NEXT_PUBLIC_` variable and must only be read
 * server-side (see `client.ts`).
 */

export const RCTA_DEFAULT_URL = "https://app.rcta.me/";

export type RctaPublicEnv = Readonly<Record<string, string | undefined>>;

/**
 * Returns the RCTA launch URL. Only plain https URLs without query string or fragment are accepted, so
 * patient data can never travel in the URL (RCTA does not document any launch parameters).
 */
export function resolveRctaExternalUrl(
  env: RctaPublicEnv = { NEXT_PUBLIC_RCTA_URL: process.env.NEXT_PUBLIC_RCTA_URL }
): string {
  const raw = env.NEXT_PUBLIC_RCTA_URL?.trim();
  if (!raw) return RCTA_DEFAULT_URL;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) {
      return RCTA_DEFAULT_URL;
    }
    return url.toString();
  } catch {
    return RCTA_DEFAULT_URL;
  }
}

export const RCTA_EXTERNAL_URL = resolveRctaExternalUrl();

/** Anchor attributes for every RCTA launch: new tab, no opener, no referrer (no patient URL leak). */
export const RCTA_LINK_TARGET = "_blank";
export const RCTA_LINK_REL = "noopener noreferrer";
