export const CLINICAL_EXPORT_SECTIONS = [
  { id: "demographics", label: "Datos demográficos" },
  { id: "medical_history", label: "Antecedentes" },
  { id: "allergies", label: "Alergias" },
  { id: "consultations", label: "Consultas" },
  { id: "diagnoses", label: "Diagnósticos" },
  { id: "medications", label: "Medicación / tratamientos" },
  { id: "prescriptions", label: "Recetas" },
  { id: "orders", label: "Órdenes médicas" },
  { id: "studies", label: "Estudios" },
  { id: "attachments", label: "Adjuntos" },
] as const;

export type ClinicalExportSection = (typeof CLINICAL_EXPORT_SECTIONS)[number]["id"];

export const ALL_CLINICAL_EXPORT_SECTIONS: ClinicalExportSection[] =
  CLINICAL_EXPORT_SECTIONS.map((item) => item.id);

const SECTION_SET = new Set<string>(ALL_CLINICAL_EXPORT_SECTIONS);

export function parseClinicalExportSections(raw: unknown): ClinicalExportSection[] {
  if (!Array.isArray(raw)) return [...ALL_CLINICAL_EXPORT_SECTIONS];
  const selected = raw.filter((item): item is ClinicalExportSection =>
    typeof item === "string" && SECTION_SET.has(item)
  );
  return selected.length > 0 ? selected : [...ALL_CLINICAL_EXPORT_SECTIONS];
}

export function isIsoDateOnly(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function isoDay(value: string | null | undefined): string | null {
  if (!value) return null;
  const day = value.slice(0, 10);
  return isIsoDateOnly(day) ? day : null;
}

export function inExportDateRange(
  value: string | null | undefined,
  from: string | null,
  to: string | null
): boolean {
  if (!from && !to) return true;
  const day = isoDay(value);
  if (!day) return false;
  if (from && day < from) return false;
  if (to && day > to) return false;
  return true;
}

export type ClinicalExportDateRange = {
  from: string | null;
  to: string | null;
};

export function parseExportDateRange(
  fromRaw: unknown,
  toRaw: unknown
): { ok: true; range: ClinicalExportDateRange } | { ok: false; error: string } {
  const from = typeof fromRaw === "string" && fromRaw.trim() ? fromRaw.trim() : null;
  const to = typeof toRaw === "string" && toRaw.trim() ? toRaw.trim() : null;
  if (from && !isIsoDateOnly(from)) return { ok: false, error: "Fecha desde inválida." };
  if (to && !isIsoDateOnly(to)) return { ok: false, error: "Fecha hasta inválida." };
  if (from && to && from > to) return { ok: false, error: "El rango de fechas es inválido." };
  return { ok: true, range: { from, to } };
}
