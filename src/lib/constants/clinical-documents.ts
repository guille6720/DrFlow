export const CLINICAL_DOCUMENT_CATEGORIES = [
  { value: "historia_clinica", label: "Historia clínica previa" },
  { value: "estudio", label: "Estudio / informe" },
  { value: "otro", label: "Otro documento" },
] as const;

export type ClinicalDocumentCategory = (typeof CLINICAL_DOCUMENT_CATEGORIES)[number]["value"];

export const CLINICAL_DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;

export const CLINICAL_PDF_IMPORT_MAX_FILES = 50;

export const CLINICAL_CSV_MAX_BYTES = 8 * 1024 * 1024;
export const CLINICAL_CSV_MAX_ROWS = 5000;

export const CONSUMERS_IMPORT_MAX_BYTES = 15 * 1024 * 1024;
export const CONSUMERS_IMPORT_MAX_ROWS = 5000;

export const HCE_EXPORT_MAX_BYTES = 15 * 1024 * 1024;
export const HCE_EXPORT_MAX_ROWS = 15_000;
export const HCE_IMPORT_BATCH_SIZE = 120;

export const TEAMS_JSONL_MAX_BYTES = 55 * 1024 * 1024;
export const TEAMS_JSONL_MAX_ROWS = 20_000;
export const TEAMS_JSONL_IMPORT_BATCH_SIZE = 150;

export const FHIR_IMPORT_MAX_BYTES = 2 * 1024 * 1024;
export const FHIR_IMPORT_MAX_PATIENTS = 50;
export const FHIR_IMPORT_MAX_ENCOUNTERS = 200;
export const FHIR_IMPORT_MAX_RESOURCES = 500;

export const BULK_EXPORT_MAX_SELECTED_PATIENTS = 200;
export const BULK_EXPORT_MAX_CSV_DEMOGRAPHICS = 5000;
export const BULK_EXPORT_MAX_CSV_CLINICAL = 500;
export const BULK_EXPORT_MAX_JSON_PATIENTS = 200;
export const BULK_EXPORT_MAX_FHIR_PATIENTS = 100;
export const BULK_EXPORT_MAX_ZIP_PATIENTS = 25;
export const BULK_EXPORT_ZIP_MAX_BYTES = 80 * 1024 * 1024;

export function clinicalDocumentCategoryLabel(category: string | null | undefined): string {
  return (
    CLINICAL_DOCUMENT_CATEGORIES.find((item) => item.value === category)?.label ?? "Documento"
  );
}
