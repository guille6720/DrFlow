/**
 * NexClinic public brand identity.
 * Internal legacy ids (cookies `drflow_*`, CSS `.drflow-*`, env `DRFLOW_*`) stay unchanged.
 */

export const BRAND_NAME = "NexClinic";
export const BRAND_TAGLINE = "Gestión médica inteligente";
export const BRAND_NAME_WITH_TAGLINE = `${BRAND_NAME} — ${BRAND_TAGLINE}`;

export const BRAND_SEO_TITLE = `${BRAND_NAME} | ${BRAND_TAGLINE}`;
export const BRAND_SEO_DESCRIPTION =
  "Software de gestión para clínicas y profesionales de la salud.";

export const BRAND_OG_DESCRIPTION =
  "Agenda, pacientes, historia clínica, recetas y app para pacientes. Pensado para médicos en Argentina.";

/** Canonical production hostname (OpusOrg subdomain). Staging may still use Vercel preview. */
export const BRAND_CANONICAL_HOST = "nexclinic.opusorg.com";
export const BRAND_CANONICAL_URL = `https://${BRAND_CANONICAL_HOST}`;

/** Legacy public hosts kept for redirects / dual-read until production cutover is approved. */
export const BRAND_LEGACY_HOSTS = [
  "drflow.opusorg.com",
  "nexclinic.com",
  "drflow-app-rho.vercel.app",
] as const;

export const BRAND_COLORS = {
  navy: "#0B1F3A",
  navySoft: "#1A2B4A",
  blue: "#1E4FD6",
  turquoise: "#14B8A6",
  green: "#22C55E",
  gray: "#64748B",
  white: "#FFFFFF",
} as const;

export const BRAND_GRADIENT_CSS =
  "linear-gradient(135deg, #0B1F3A 0%, #1E4FD6 38%, #14B8A6 72%, #22C55E 100%)";
