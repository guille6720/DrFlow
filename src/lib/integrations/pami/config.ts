/**
 * PAMI public configuration (phase 1: external link to the official PAMI entry pages only).
 *
 * `NEXT_PUBLIC_PAMI_PRESCRIPTION_URL` / `NEXT_PUBLIC_PAMI_OME_URL` are PUBLIC values (official PAMI pages),
 * not secrets. PAMI/CUP credentials, OTP codes, cookies or session tokens must never be configured,
 * stored or handled by NexClinic: authentication belongs exclusively to PAMI/CUP.
 */

export const PAMI_DEFAULT_PRESCRIPTION_URL = "https://prestadores.pami.org.ar/receta-electronica.php";
export const PAMI_DEFAULT_OME_URL = "https://prestadores.pami.org.ar/ome.php";

/** Approved PAMI domains (exact host or subdomain). */
export const PAMI_ALLOWED_DOMAINS = ["pami.org.ar"] as const;

function isAllowedPamiHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return PAMI_ALLOWED_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`));
}

/**
 * Accepts only https URLs on an approved PAMI domain, without credentials, query string or fragment, so
 * patient data can never travel in the URL (PAMI does not document any launch parameters).
 */
export function resolvePamiUrl(raw: string | undefined, fallback: string): string {
  const value = raw?.trim();
  if (!value) return fallback;
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      url.search ||
      url.hash ||
      !isAllowedPamiHost(url.hostname)
    ) {
      return fallback;
    }
    return url.toString();
  } catch {
    return fallback;
  }
}

export const PAMI_PRESCRIPTION_URL = resolvePamiUrl(
  process.env.NEXT_PUBLIC_PAMI_PRESCRIPTION_URL,
  PAMI_DEFAULT_PRESCRIPTION_URL
);
export const PAMI_OME_URL = resolvePamiUrl(process.env.NEXT_PUBLIC_PAMI_OME_URL, PAMI_DEFAULT_OME_URL);

/** Anchor attributes for every PAMI launch: new tab, no opener, no referrer. */
export const PAMI_LINK_TARGET = "_blank";
export const PAMI_LINK_REL = "noopener noreferrer";
