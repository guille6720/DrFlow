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

export const DRAPP_CONSUMERS_MAX_BYTES = 15 * 1024 * 1024;
export const DRAPP_CONSUMERS_MAX_ROWS = 5000;

export const HCE_EXPORT_MAX_BYTES = 15 * 1024 * 1024;
export const HCE_EXPORT_MAX_ROWS = 15_000;
export const HCE_IMPORT_BATCH_SIZE = 120;

export function clinicalDocumentCategoryLabel(category: string | null | undefined): string {
  return (
    CLINICAL_DOCUMENT_CATEGORIES.find((item) => item.value === category)?.label ?? "Documento"
  );
}
