import {
  PATIENT_IMPORT_REQUIRED_FIELDS,
  type PatientColumnMapping,
  type PatientImportField,
} from "@/features/integraciones/lib/patient-import-mapping";
import {
  emptyToNull,
  normalizeBirthDate,
  normalizeDocumentNumber,
  type NormalizedPatientImportRow,
  normalizeEmail,
  normalizePhone,
  titleCaseName,
  trimImportValue,
} from "@/features/integraciones/lib/patient-import-normalize";

export type PatientImportIssueCode =
  | "missing_dni"
  | "invalid_dni"
  | "missing_name"
  | "invalid_date"
  | "invalid_email"
  | "empty_row";

export type PatientImportIssue = {
  lineNumber: number;
  code: PatientImportIssueCode;
  message: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function mapSpreadsheetRow(
  cells: Record<string, string>,
  mapping: PatientColumnMapping,
  lineNumber: number,
  dateFormat?: string | null
): NormalizedPatientImportRow {
  const read = (field: PatientImportField): string => {
    const header = mapping[field];
    if (!header) return "";
    return trimImportValue(cells[header]);
  };

  return {
    lineNumber,
    document_number: normalizeDocumentNumber(read("document_number")),
    last_name: titleCaseName(read("last_name")),
    first_name: titleCaseName(read("first_name")),
    birth_date: normalizeBirthDate(read("birth_date"), dateFormat),
    phone: normalizePhone(read("phone") ?? ""),
    email: normalizeEmail(read("email") ?? ""),
    address: emptyToNull(read("address")),
    insurance_provider: emptyToNull(read("insurance_provider")),
    insurance_plan: emptyToNull(read("insurance_plan")),
    insurance_number: emptyToNull(read("insurance_number")),
    emergency_contact_name: emptyToNull(read("emergency_contact_name")),
    emergency_contact_phone: normalizePhone(read("emergency_contact_phone") ?? ""),
  };
}

export function validatePatientImportRow(
  row: NormalizedPatientImportRow,
  raw: { document: string; birthDate: string }
): PatientImportIssue[] {
  const issues: PatientImportIssue[] = [];
  const empty =
    !raw.document.trim() &&
    !row.last_name &&
    !row.first_name &&
    !raw.birthDate.trim() &&
    !row.phone &&
    !row.email;

  if (empty) {
    issues.push({
      lineNumber: row.lineNumber,
      code: "empty_row",
      message: `Fila ${row.lineNumber}: fila vacía.`,
    });
    return issues;
  }

  if (!raw.document.trim()) {
    issues.push({
      lineNumber: row.lineNumber,
      code: "missing_dni",
      message: `Fila ${row.lineNumber}: falta el DNI.`,
    });
  } else if (!row.document_number) {
    issues.push({
      lineNumber: row.lineNumber,
      code: "invalid_dni",
      message: `Fila ${row.lineNumber}: DNI inválido.`,
    });
  }

  if (!row.last_name || !row.first_name) {
    issues.push({
      lineNumber: row.lineNumber,
      code: "missing_name",
      message: `Fila ${row.lineNumber}: faltan nombre o apellido.`,
    });
  }

  if (raw.birthDate.trim() && !row.birth_date) {
    issues.push({
      lineNumber: row.lineNumber,
      code: "invalid_date",
      message: `Fila ${row.lineNumber}: fecha de nacimiento inválida.`,
    });
  }

  if (row.email && !EMAIL_RE.test(row.email)) {
    issues.push({
      lineNumber: row.lineNumber,
      code: "invalid_email",
      message: `Fila ${row.lineNumber}: email inválido.`,
    });
  }

  return issues;
}

export function isMappingComplete(mapping: PatientColumnMapping): boolean {
  return PATIENT_IMPORT_REQUIRED_FIELDS.every((field) => Boolean(mapping[field]));
}

export function mappingMissingFields(mapping: PatientColumnMapping): PatientImportField[] {
  return PATIENT_IMPORT_REQUIRED_FIELDS.filter((field) => !mapping[field]);
}
