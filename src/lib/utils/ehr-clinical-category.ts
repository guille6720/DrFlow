/** Detecta si un texto corresponde a un fármaco / producto recetado y no a un diagnóstico clínico. */
export function looksLikeMedication(text: string): boolean {
  const t = text.trim();
  if (!t) return false;

  if (/\bCIE-10\s*:/i.test(t)) return false;
  if (/\bno especificad[ao]\b/i.test(t)) return false;
  if (/\bsin mención\b/i.test(t)) return false;

  if (
    /\b(comp\.?|caps\.?|cáps|cápsulas|comprimidos|oft\.?|sol\.?|jarabe|susp\.?|ung\.?|gel|crema|amp\.?|inyect|rec\.?|estéril|estéril)\b/i.test(
      t
    )
  ) {
    return true;
  }

  if (/\d+(?:[.,]\d+)?\s*(?:mg|mcg|µg|g|ml|ui|%|mcg\/ml|mg\/ml)\b/i.test(t)) return true;

  if (/\bx\s*\d+\b/i.test(t)) return true;

  if (
    /^[A-Za-zÁÉÍÓÚáéíóúÑñ]+(?:\s+[A-Za-zÁÉÍÓÚáéíóúÑñ]+)?\s*-\s*[A-Z0-9][A-Z0-9\s.-]+\s*-\s*\d/i.test(
      t
    )
  ) {
    return true;
  }

  if (/^[A-Z][A-Za-z0-9]+\s+\d+(?:[.,]\d+)?\s*(?:mg|mcg|ml|g)\b/i.test(t)) return true;

  return false;
}

export function stripDiagnosisDecorators(name: string): string {
  return name
    .replace(/^Crónico\s+/i, "")
    .replace(/\s*CIE-10:\s*[A-Z0-9.]+/i, "")
    .trim();
}

export function extractMedicationDose(text: string): string {
  const match = text.match(/(\d+(?:[.,]\d+)?\s*(?:mg|mcg|µg|g|ml|ui|%|mcg\/ml|mg\/ml))/i);
  return match?.[1] ?? "—";
}
