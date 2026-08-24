export type ClinicalTreatmentKind =
  | "pharmacologic"
  | "non_pharmacologic"
  | "conduct"
  | "medication"
  | "free_text";

export type ClinicalTreatmentCatalogHit = {
  id: string;
  name: string;
  normalized_name: string | null;
  kind: Exclude<ClinicalTreatmentKind, "medication" | "free_text">;
  category: string;
  synonyms: string[];
};

export const CLINICAL_TREATMENT_KIND_LABELS: Record<
  Exclude<ClinicalTreatmentKind, "medication" | "free_text">,
  string
> = {
  pharmacologic: "Farmacológicos",
  non_pharmacologic: "No farmacológicos",
  conduct: "Conductas",
};
