/** Safe filename segment for clinical history exports. */
export function sanitizeClinicalFilenamePart(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w.-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

/** Local `YYYY-MM-DD_HH-mm` stamp for download filenames (not UTC). */
export function formatLocalDownloadStamp(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}`;
}

function formatLocalDateStamp(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function buildClinicalHistoryFilename(input: {
  last_name: string;
  first_name: string;
  document_number?: string;
  consultationDate?: string | Date | null;
  downloadedAt?: Date;
}): string {
  const last = sanitizeClinicalFilenamePart(input.last_name);
  const first = sanitizeClinicalFilenamePart(input.first_name);
  const dni = sanitizeClinicalFilenamePart(input.document_number ?? "");
  const stamp = formatLocalDownloadStamp(input.downloadedAt ?? new Date());
  const parts = [last, first, dni, stamp].filter(Boolean);
  return `${parts.join("_")}.pdf`;
}

/**
 * Nombre sugerido al imprimir / Guardar como PDF la HC completa:
 * Historia_Clinica_Apellido_Nombre_DNI_YYYY-MM-DD
 */
export function buildHistoriaClinicaPrintFilename(input: {
  last_name: string;
  first_name: string;
  document_number?: string;
  downloadedAt?: Date;
}): string {
  const last = sanitizeClinicalFilenamePart(input.last_name);
  const first = sanitizeClinicalFilenamePart(input.first_name);
  const dni = sanitizeClinicalFilenamePart(input.document_number ?? "");
  const stamp = formatLocalDateStamp(input.downloadedAt ?? new Date());
  const parts = ["Historia_Clinica", last, first, dni, stamp].filter(Boolean);
  return `${parts.join("_")}.pdf`;
}

export function buildClinicalPackageBaseName(input: {
  last_name: string;
  first_name: string;
  document_number?: string;
}): string {
  const last = sanitizeClinicalFilenamePart(input.last_name);
  const first = sanitizeClinicalFilenamePart(input.first_name);
  const dni = sanitizeClinicalFilenamePart(input.document_number ?? "");
  return [last, first, dni].filter(Boolean).join("_") || "historia_clinica";
}

export function buildClinicalPackageZipFilename(input: {
  last_name: string;
  first_name: string;
  document_number?: string;
}): string {
  return `${buildClinicalPackageBaseName(input)}.zip`;
}

export function buildClinicalPackageJsonFilename(input: {
  last_name: string;
  first_name: string;
  document_number?: string;
}): string {
  return `${buildClinicalPackageBaseName(input)}.json`;
}

/** Browser print/Save-as-PDF uses `document.title` as the default filename. */
export function clinicalHistoryPrintTitle(input: {
  last_name: string;
  first_name: string;
  document_number?: string;
  downloadedAt?: Date;
}): string {
  return buildHistoriaClinicaPrintFilename(input).replace(/\.pdf$/i, "");
}

export const EHR_NEW_CONSULT_FORM_ID = "ehr-new-consult-form";
