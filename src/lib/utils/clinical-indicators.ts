/** Índice de masa corporal (kg/m²). */
export function calculateBmi(weightKg: number, heightCm: number): number | null {
  if (!Number.isFinite(weightKg) || !Number.isFinite(heightCm) || weightKg <= 0 || heightCm <= 0) {
    return null;
  }
  const heightM = heightCm / 100;
  return Math.round((weightKg / (heightM * heightM)) * 10) / 10;
}

/** Paquetes-año = (cigarrillos/día ÷ 20) × años. */
export function calculatePackYears(cigarettesPerDay: number, smokingYears: number): number | null {
  if (
    !Number.isFinite(cigarettesPerDay) ||
    !Number.isFinite(smokingYears) ||
    cigarettesPerDay < 0 ||
    smokingYears < 0
  ) {
    return null;
  }
  if (cigarettesPerDay === 0 || smokingYears === 0) return 0;
  return Math.round((cigarettesPerDay / 20) * smokingYears * 10) / 10;
}

/** CKD-EPI 2009 (creatinina en mg/dL). */
export function estimateTfgCkdEpi(input: {
  ageYears: number;
  creatinineMgDl: number;
  sex?: "M" | "F" | null;
}): number | null {
  const { ageYears, creatinineMgDl, sex } = input;
  if (!Number.isFinite(ageYears) || ageYears <= 0 || !Number.isFinite(creatinineMgDl) || creatinineMgDl <= 0) {
    return null;
  }

  const isFemale = sex === "F";
  const k = isFemale ? 0.7 : 0.9;
  const alpha = creatinineMgDl <= k ? (isFemale ? -0.329 : -0.411) : -1.209;
  const factor = isFemale ? 144 : 141;
  const minCr = Math.min(creatinineMgDl / k, 1);
  const maxCr = Math.max(creatinineMgDl / k, 1);

  return Math.round(factor * minCr ** alpha * maxCr ** -1.209 * 0.993 ** ageYears);
}

export function formatTfgLabel(value: number | null): string | null {
  if (value == null) return null;
  return `${value} ml/min/1.73m² (estimado)`;
}

export function cardiovascularRiskLabel(
  risk: "low" | "moderate" | "high" | null | undefined
): string {
  if (risk === "high") return "Alto";
  if (risk === "moderate") return "Moderado";
  if (risk === "low") return "Bajo";
  return "Sin evaluar";
}

export function parseOptionalNumber(raw: string): number | null {
  const trimmed = raw.trim().replace(",", ".");
  if (!trimmed) return null;
  const n = parseFloat(trimmed);
  return Number.isFinite(n) ? n : null;
}
