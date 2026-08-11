import type { CoverageKind } from "@/features/recetas/engine/types";

import { isPamiCoverage } from "@/lib/constants/coverages";

const PREPAID_KEYWORDS = [
  "osde",
  "swiss medical",
  "galeno",
  "medifé",
  "medife",
  "omint",
  "medicus",
  "sancor",
  "hospital italiano",
  "accord salud",
] as const;

function normalizeInsurance(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

export function resolveCoverageKind(insurance: string | null | undefined): CoverageKind {
  const normalized = normalizeInsurance(insurance);
  if (!normalized || normalized === "particular") return "PARTICULAR";
  if (isPamiCoverage(insurance)) return "PAMI";
  if (PREPAID_KEYWORDS.some((keyword) => normalized.includes(keyword))) return "PREPAGAS";
  return "OBRAS_SOCIALES";
}
