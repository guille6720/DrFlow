/** Safe filename segment for clinical history exports. */
export function sanitizeClinicalFilenamePart(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w.-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

export function buildClinicalHistoryFilename(input: {
  last_name: string;
  first_name: string;
  document_number: string;
  consultationDate?: string | Date | null;
}): string {
  const last = sanitizeClinicalFilenamePart(input.last_name);
  const first = sanitizeClinicalFilenamePart(input.first_name);
  const dni = sanitizeClinicalFilenamePart(input.document_number);
  const dateSource = input.consultationDate ?? new Date();
  const date =
    dateSource instanceof Date
      ? dateSource.toISOString().slice(0, 10)
      : new Date(dateSource).toISOString().slice(0, 10);

  return `${last}_${first}_${dni}_${date}.pdf`;
}

export const EHR_NEW_CONSULT_FORM_ID = "ehr-new-consult-form";
