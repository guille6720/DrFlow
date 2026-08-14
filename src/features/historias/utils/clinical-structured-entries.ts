import type { ClinicalTreatmentKind } from "@/features/historias/types/clinical-treatment-catalog";

import type { PrescriptionMedication } from "@/types/prescription";

export type ClinicalDiagnosisEntry = {
  name: string;
  cie10_code?: string | null;
  cie11_code?: string | null;
  snomed_code?: string | null;
  clinical_diagnosis_id?: string | null;
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
  kind?: ClinicalTreatmentKind | null;
  category?: string | null;
  clinical_treatment_id?: string | null;
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

/** Snapshot imprimible de tratamientos. No está pensado para re-parsearse a filas. */
export function buildIndicationsSnapshot(
  treatments: ClinicalTreatmentEntry[],
  freeText = ""
): string {
  const plan = treatments.filter((t) => t.kind !== "medication");
  const meds = treatments.filter((t) => t.kind === "medication");

  function linesFor(rows: ClinicalTreatmentEntry[]): string[] {
    return rows
      .map((t) => {
        const product = t.product.trim();
        if (!product) return "";
        const parts = [product, t.dose?.trim(), t.frequency?.trim()].filter(Boolean);
        const base = `- ${parts.join(" · ")}`;
        const notes = t.notes?.trim();
        return notes ? `${base} (${notes})` : base;
      })
      .filter(Boolean);
  }

  const blocks: string[] = [];
  const planLines = linesFor(plan);
  if (planLines.length > 0) blocks.push(`Tratamiento / conducta:\n${planLines.join("\n")}`);
  const medLines = linesFor(meds);
  if (medLines.length > 0) blocks.push(`Medicamento:\n${medLines.join("\n")}`);
  const notes = freeText.trim();
  if (notes) blocks.push(blocks.length > 0 ? `Notas:\n${notes}` : notes);
  return blocks.join("\n\n");
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
      // Solo dosis indicada por el médico; no usar concentración de catálogo como dosis.
      dose: med.dose?.trim() || undefined,
      frequency: med.frequency?.trim() || med.posology?.trim() || undefined,
      notes: med.instructions?.trim() || undefined,
      status: "Actual",
      quantity: med.quantity,
      vademecum_code: med.vademecum_code ?? null,
      catalog_source: med.search_source ?? null,
      active_ingredient: med.active_ingredient ?? med.generic_name,
      kind: "medication" as const,
      category: "Medicamento",
    };
  });
}

export function mergeTreatmentsForPersist(
  catalogTreatments: ClinicalTreatmentEntry[],
  medications: PrescriptionMedication[]
): ClinicalTreatmentEntry[] {
  return [...catalogTreatments, ...medicationsToTreatmentEntries(medications)];
}

export function parseDiagnosesJson(raw: unknown): ClinicalDiagnosisEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: ClinicalDiagnosisEntry[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const name = typeof row.name === "string" ? row.name.trim() : "";
    if (!name) continue;
    out.push({
      name,
      cie10_code: typeof row.cie10_code === "string" ? row.cie10_code : null,
      cie11_code: typeof row.cie11_code === "string" ? row.cie11_code : null,
      snomed_code: typeof row.snomed_code === "string" ? row.snomed_code : null,
      clinical_diagnosis_id:
        typeof row.clinical_diagnosis_id === "string"
          ? row.clinical_diagnosis_id
          : typeof row.catalog_id === "string"
            ? row.catalog_id
            : null,
      pathology_id: typeof row.pathology_id === "string" ? row.pathology_id : null,
      is_chronic: Boolean(row.is_chronic),
    });
  }
  return out;
}

export function parseTreatmentsJson(raw: unknown): ClinicalTreatmentEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: ClinicalTreatmentEntry[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const product = typeof row.product === "string" ? row.product.trim() : "";
    if (!product) continue;
    out.push({
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
      kind:
        typeof row.kind === "string"
          ? (row.kind as ClinicalTreatmentEntry["kind"])
          : typeof row.treatment_kind === "string"
            ? (row.treatment_kind as ClinicalTreatmentEntry["kind"])
            : null,
      category: typeof row.category === "string" ? row.category : null,
      clinical_treatment_id:
        typeof row.clinical_treatment_id === "string" ? row.clinical_treatment_id : null,
    });
  }
  return out;
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
