export type ClinicalDiagnosisCatalogHit = {
  id: string;
  name: string;
  normalized_name: string | null;
  snomed_code: string | null;
  cie10_code: string | null;
  cie11_code: string | null;
  category: string | null;
  synonyms: string[];
};
