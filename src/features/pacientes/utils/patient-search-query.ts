import {
  isSingleLetterSearch,
  patientSearchTokens,
  sanitizePatientSearchTerm,
} from "@/features/pacientes/utils/patient-search";

export const PATIENT_SEARCH_DEBOUNCE_MS = 350;
export const PATIENT_SEARCH_MIN_TEXT_LENGTH = 2;

/** Strips non-digits for DNI / phone matching. */
export function extractPatientSearchDigits(raw: string): string {
  return raw.replace(/\D/g, "");
}

/** True when the query looks like a document number (digits and separators only). */
export function isPatientDocumentSearchQuery(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return false;
  return /^[\d.\-\s]+$/.test(trimmed);
}

/** Minimum characters before a remote search runs (DNI and single-letter prefix exempt). */
export function resolvePatientSearchMinLength(raw: string, defaultMin = PATIENT_SEARCH_MIN_TEXT_LENGTH): number {
  const trimmed = sanitizePatientSearchTerm(raw);
  if (!trimmed) return defaultMin;
  if (isSingleLetterSearch(trimmed)) return 1;
  if (isPatientDocumentSearchQuery(trimmed)) return 1;
  return defaultMin;
}

/** Whether the client/server should execute a patient search for this query. */
export function shouldExecutePatientSearch(
  raw: string,
  defaultMin = PATIENT_SEARCH_MIN_TEXT_LENGTH
): boolean {
  const trimmed = sanitizePatientSearchTerm(raw);
  if (!trimmed) return false;

  const minLength = resolvePatientSearchMinLength(trimmed, defaultMin);
  if (trimmed.length >= minLength) return true;

  const digits = extractPatientSearchDigits(trimmed);
  return digits.length >= 3;
}

/** Validates server-side search input after sanitization. */
export function validatePatientSearchQuery(raw: string | undefined): { ok: true; q: string } | { ok: false } {
  const q = sanitizePatientSearchTerm(raw);
  if (!q) return { ok: false };
  if (!shouldExecutePatientSearch(q)) return { ok: false };
  if (patientSearchTokens(q).length === 0 && !isSingleLetterSearch(q)) return { ok: false };
  return { ok: true, q };
}
