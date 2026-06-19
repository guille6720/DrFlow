export const CLINICAL_DOCUMENT_CATEGORIES = [
  { value: "historia_clinica", label: "Historia clínica previa" },
  { value: "estudio", label: "Estudio / informe" },
  { value: "otro", label: "Otro documento" },
] as const;

export type ClinicalDocumentCategory = (typeof CLINICAL_DOCUMENT_CATEGORIES)[number]["value"];

export const CLINICAL_DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;

export const CLINICAL_PDF_IMPORT_MAX_FILES = 30;

export function clinicalDocumentCategoryLabel(category: string | null | undefined): string {
  return (
    CLINICAL_DOCUMENT_CATEGORIES.find((item) => item.value === category)?.label ?? "Documento"
  );
}
