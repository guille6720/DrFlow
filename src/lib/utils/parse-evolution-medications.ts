import type { PrescriptionMedication } from "@/types/prescription";

const BULLET_LINE = /^[\s]*[•\-\*]/;
const DOSIS_PREFIX = /^Dosis ref\.:\s*/i;
const GENERIC_BRAND = /^(.+?)\s*\((.+)\)$/;

function parseGenericBrand(part: string): { generic: string; brand: string } {
  const trimmed = part.trim();
  const match = trimmed.match(GENERIC_BRAND);
  if (match) {
    return { generic: match[1].trim(), brand: match[2].trim() };
  }
  return { generic: trimmed, brand: "" };
}

export function isEvolutionMedicationLine(line: string): boolean {
  return BULLET_LINE.test(line.trim());
}

/** Convierte líneas de medicación agregadas desde la guía farmacológica en filas de receta. */
export function parseEvolutionMedicationLine(line: string): PrescriptionMedication | null {
  if (!isEvolutionMedicationLine(line)) return null;

  const cleaned = line.replace(/^[\s•\-\*]+/, "").trim();
  if (!cleaned) return null;

  const parts = cleaned.split(/\s+—\s+/);
  const { generic, brand: brandFromParen } = parseGenericBrand(parts[0]);
  if (!generic) return null;

  let brand = brandFromParen;
  let presentation = "";
  let posology = "Según indicación médica";

  const rest = parts.slice(1);
  const dosisPart = rest.find((part) => DOSIS_PREFIX.test(part.trim()));
  if (dosisPart) {
    posology = dosisPart.replace(DOSIS_PREFIX, "").trim() || posology;
  }

  const nonDosis = rest.filter((part) => !DOSIS_PREFIX.test(part.trim()));

  if (nonDosis.length === 1) {
    presentation = nonDosis[0].trim();
  } else if (nonDosis.length >= 2 && !brandFromParen) {
    brand = nonDosis[0].trim();
    presentation = nonDosis.slice(1).join(" — ").trim();
  } else if (nonDosis.length >= 1) {
    presentation = nonDosis.join(" — ").trim();
  }

  return {
    generic_name: generic,
    brand_name: brand,
    presentation,
    concentration: "",
    quantity: 1,
    posology,
    route: "oral",
  };
}

export function parseEvolutionMedications(text: string | null | undefined): PrescriptionMedication[] {
  if (!text?.trim()) return [];

  return text
    .split(/\n/)
    .map((line) => parseEvolutionMedicationLine(line))
    .filter((med): med is PrescriptionMedication => med !== null);
}

/** Texto clínico de la evolución sin las líneas de medicación con viñeta. */
export function extractEvolutionDiagnosis(text: string | null | undefined): string {
  if (!text?.trim()) return "";

  return text
    .split(/\n/)
    .filter((line) => !isEvolutionMedicationLine(line))
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n\n")
    .trim();
}
