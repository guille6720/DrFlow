export interface Pathology {
  id: string;
  name: string;
  cie10_code: string;
  description: string | null;
}

export interface Drug {
  id: string;
  name: string;
  active_ingredient: string;
  atc_code: string;
  atc_description: string | null;
  presentation: string | null;
  route: string | null;
}

export interface PathologyDrug {
  id: string;
  pathology_id: string;
  drug_id: string;
  treatment_line: number;
  priority: number;
  indication_notes: string | null;
  dosage_reference: string | null;
  drugs: Drug | Drug[];
}

export interface PathologySearchResult {
  id: string;
  name: string;
  cie10_code: string;
  description: string | null;
}

export interface SymptomSearchResult {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
}

export interface PathologyBySymptomResult extends PathologySearchResult {
  match_count: number;
  relevance_score: number;
  matched_symptoms: string[];
}

export type PharmacologySearchMode = "pathology" | "symptoms";

export const TREATMENT_LINE_LABELS: Record<number, string> = {
  1: "Primera línea",
  2: "Segunda línea",
  3: "Tercera línea",
  4: "Cuarta línea",
  5: "Quinta línea",
};

export const SYMPTOM_RELEVANCE_HINT: Record<number, string> = {
  3: "Muy sugestivo",
  2: "Frecuente",
  1: "Asociado",
};
