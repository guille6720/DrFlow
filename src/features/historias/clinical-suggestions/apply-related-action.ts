import type { RelatedActionDefinition } from "@/features/historias/clinical-suggestions/types";
import type { ClinicalTreatmentEntry } from "@/features/historias/utils/clinical-structured-entries";

/** Convierte una acción confirmada en entrada de tratamiento/conducta (sin dosis). */
export function relatedActionToTreatmentEntry(
  action: RelatedActionDefinition
): ClinicalTreatmentEntry {
  const { applyAs } = action;
  return {
    product: applyAs.product,
    kind: applyAs.treatmentKind,
    category: applyAs.category,
    status: "Actual",
    catalog_source: "diagnosis_related_suggestion",
    notes: undefined,
    dose: undefined,
    frequency: undefined,
  };
}

export function treatmentAlreadyIncludesAction(
  treatments: ClinicalTreatmentEntry[],
  action: RelatedActionDefinition
): boolean {
  const key = action.applyAs.product.trim().toLowerCase();
  return treatments.some((t) => t.product.trim().toLowerCase() === key);
}
