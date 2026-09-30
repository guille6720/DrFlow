/**
 * PAMI coverage detection.
 *
 * Patients store coverage as the catalog label in `patients.insurance_provider` (see STANDARD_COVERAGES);
 * there is no insurer id column. The label is normalized to a canonical key (accents, case, punctuation and
 * whole tokens) instead of a loose substring match. Used only to emphasize PAMI actions in the UI; it never
 * decides clinical eligibility or permissions.
 */

export type CanonicalCoverageKey = "PAMI";

const PAMI_TOKENS = new Set(["PAMI", "INSSJP"]);
const PAMI_FULL_NAME = "INSTITUTO NACIONAL DE SERVICIOS SOCIALES PARA JUBILADOS Y PENSIONADOS";

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

export function canonicalCoverageKey(provider: string | null | undefined): CanonicalCoverageKey | null {
  if (!provider) return null;
  const normalized = normalize(provider);
  if (!normalized) return null;
  if (normalized.split(" ").some((token) => PAMI_TOKENS.has(token))) return "PAMI";
  if (normalized.includes(PAMI_FULL_NAME)) return "PAMI";
  return null;
}

export function isCanonicalPamiCoverage(provider: string | null | undefined): boolean {
  return canonicalCoverageKey(provider) === "PAMI";
}
