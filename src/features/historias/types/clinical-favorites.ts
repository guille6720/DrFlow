export type ClinicalFavoriteKind = "diagnosis" | "treatment" | "medication";

export type ClinicalFavoriteDiagnosisPayload = {
  name: string;
  cie10_code?: string | null;
  cie11_code?: string | null;
  snomed_code?: string | null;
  clinical_diagnosis_id?: string | null;
};

export type ClinicalFavoriteTreatmentPayload = {
  product: string;
  kind?: string | null;
  category?: string | null;
  clinical_treatment_id?: string | null;
};

export type ClinicalFavoriteMedicationPayload = {
  generic_name: string;
  brand_name?: string | null;
  presentation?: string | null;
  concentration?: string | null;
  pharmaceutical_form?: string | null;
  vademecum_code?: string | null;
  active_ingredient?: string | null;
};

export type ClinicalFavoritePayload =
  | ClinicalFavoriteDiagnosisPayload
  | ClinicalFavoriteTreatmentPayload
  | ClinicalFavoriteMedicationPayload;

export type ClinicalFavoriteRow = {
  id: string;
  user_id: string;
  kind: ClinicalFavoriteKind;
  fingerprint: string;
  label: string;
  payload: ClinicalFavoritePayload;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export function normalizeFavoriteText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function diagnosisFavoriteFingerprint(
  input: Pick<
    ClinicalFavoriteDiagnosisPayload,
    "clinical_diagnosis_id" | "name" | "cie10_code"
  >
): string {
  if (input.clinical_diagnosis_id?.trim()) {
    return `id:${input.clinical_diagnosis_id.trim()}`;
  }
  return `name:${normalizeFavoriteText(input.name)}|cie:${normalizeFavoriteText(input.cie10_code ?? "")}`;
}

export function treatmentFavoriteFingerprint(
  input: Pick<ClinicalFavoriteTreatmentPayload, "clinical_treatment_id" | "product" | "kind">
): string {
  if (input.clinical_treatment_id?.trim()) {
    return `id:${input.clinical_treatment_id.trim()}`;
  }
  return `name:${normalizeFavoriteText(input.product)}|kind:${normalizeFavoriteText(input.kind ?? "")}`;
}

export function medicationFavoriteFingerprint(
  input: Pick<
    ClinicalFavoriteMedicationPayload,
    "vademecum_code" | "generic_name" | "brand_name" | "presentation"
  >
): string {
  if (input.vademecum_code?.trim()) {
    return `code:${input.vademecum_code.trim().toLowerCase()}`;
  }
  return [
    "name",
    normalizeFavoriteText(input.generic_name),
    normalizeFavoriteText(input.brand_name ?? ""),
    normalizeFavoriteText(input.presentation ?? ""),
  ].join("|");
}
