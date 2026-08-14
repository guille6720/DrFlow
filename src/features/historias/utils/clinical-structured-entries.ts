import type { PrescriptionMedication } from "@/types/prescription";

export type ClinicalDiagnosisEntry = {
  name: string;
  cie10_code?: string | null;
  pathology_id?: string | null;
  is_chronic?: boolean;
};

export type ClinicalTreatmentEntry = {
  product: string;
  dose?: string;
  frequency?: string;
  notes?: string;
  status?: string;
  quantity?: number;
  vademecum_code?: string | null;
  catalog_source?: string | null;
  active_ingredient?: string | null;
};

export function buildDiagnosisText(entries: ClinicalDiagnosisEntry[], fallback = ""): string {
  if (entries.length === 0) return fallback.trim();
  return entries
    .map((d) => {
      const name = d.name.trim();
      const code = d.cie10_code?.trim();
      if (!name) return "";
      return code ? `${name} (CIE-10: ${code})` : name;
    })
    .filter(Boolean)
    .join("\n");
}

export function medicationsToTreatmentEntries(
  medications: PrescriptionMedication[]
): ClinicalTreatmentEntry[] {
  return medications.map((med) => {
    const brand = med.brand_name?.trim();
    const presentation = med.presentation?.trim();
    const product =
      brand && presentation
        ? `${brand} ${presentation}`
        : brand || med.generic_name.trim();
    return {
      product,
      dose: med.dose?.trim() || med.concentration?.trim() || undefined,
      frequency: med.frequency?.trim() || med.posology?.trim() || undefined,
      notes: med.instructions?.trim() || undefined,
      status: "Actual",
      quantity: med.quantity,
      vademecum_code: med.vademecum_code ?? null,
      catalog_source: med.search_source ?? null,
      active_ingredient: med.active_ingredient ?? med.generic_name,
    };
  });
}

export function parseDiagnosesJson(raw: unknown): ClinicalDiagnosisEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const name = typeof row.name === "string" ? row.name.trim() : "";
      if (!name) return null;
      return {
        name,
        cie10_code: typeof row.cie10_code === "string" ? row.cie10_code : null,
        pathology_id: typeof row.pathology_id === "string" ? row.pathology_id : null,
        is_chronic: Boolean(row.is_chronic),
      } satisfies ClinicalDiagnosisEntry;
    })
    .filter((x): x is ClinicalDiagnosisEntry => Boolean(x));
}

export function parseTreatmentsJson(raw: unknown): ClinicalTreatmentEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const product = typeof row.product === "string" ? row.product.trim() : "";
      if (!product) return null;
      return {
        product,
        dose: typeof row.dose === "string" ? row.dose : undefined,
        frequency: typeof row.frequency === "string" ? row.frequency : undefined,
        notes: typeof row.notes === "string" ? row.notes : undefined,
        status: typeof row.status === "string" ? row.status : "Actual",
        quantity: typeof row.quantity === "number" ? row.quantity : undefined,
        vademecum_code: typeof row.vademecum_code === "string" ? row.vademecum_code : null,
        catalog_source: typeof row.catalog_source === "string" ? row.catalog_source : null,
        active_ingredient:
          typeof row.active_ingredient === "string" ? row.active_ingredient : null,
      } satisfies ClinicalTreatmentEntry;
    })
    .filter((x): x is ClinicalTreatmentEntry => Boolean(x));
}

/** Prefer normalized child rows, then Phase 1 JSON, else empty. */
export function resolveDiagnosesForRecord(input: {
  diagnoses_rows?: ClinicalDiagnosisEntry[] | null;
  diagnoses_json?: unknown;
}): ClinicalDiagnosisEntry[] {
  if (input.diagnoses_rows && input.diagnoses_rows.length > 0) return input.diagnoses_rows;
  return parseDiagnosesJson(input.diagnoses_json);
}

export function resolveTreatmentsForRecord(input: {
  treatments_rows?: ClinicalTreatmentEntry[] | null;
  treatments_json?: unknown;
}): ClinicalTreatmentEntry[] {
  if (input.treatments_rows && input.treatments_rows.length > 0) return input.treatments_rows;
  return parseTreatmentsJson(input.treatments_json);
}

export function primaryDiagnosisCie10(entries: ClinicalDiagnosisEntry[]): string | null {
  return entries.find((d) => d.cie10_code?.trim())?.cie10_code?.trim() || null;
}

export function primaryDiagnosisText(entries: ClinicalDiagnosisEntry[]): string | null {
  const first = entries.find((d) => d.name.trim());
  return first?.name.trim() || null;
}
