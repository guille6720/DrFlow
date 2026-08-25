/**
 * Patient identity for national electronic prescriptions (Phase 2).
 * Local patient CRUD remains permissive; national e-Rx is strict.
 */

export const PATIENT_DOCUMENT_TYPES = ["dni", "passport", "cuit", "cdi", "other"] as const;
export type PatientDocumentType = (typeof PATIENT_DOCUMENT_TYPES)[number];

export const PATIENT_ALT_IDENTIFIER_TYPES = ["cuit", "cdi", "passport", "other"] as const;
export type PatientAltIdentifierType = (typeof PATIENT_ALT_IDENTIFIER_TYPES)[number];

export const PATIENT_SEX_VALUES = ["F", "M", "X"] as const;
export type PatientSex = (typeof PATIENT_SEX_VALUES)[number];

export type PatientIdentityInput = {
  patientId: string;
  clinicId: string;
  firstName: string | null;
  lastName: string | null;
  documentNumber: string | null;
  documentType: PatientDocumentType | null;
  cuil: string | null;
  altIdentifierType: PatientAltIdentifierType | null;
  altIdentifierValue: string | null;
  birthDate: string | null;
  sex: PatientSex | null;
  insuranceProvider: string | null;
  address: string | null;
};

export type PatientIdentityIssueCode =
  | "missing_name"
  | "missing_document"
  | "missing_cuil"
  | "malformed_cuil"
  | "missing_alt_identifier"
  | "missing_birth_date"
  | "missing_sex"
  | "cross_clinic";

export type PatientIdentityIssue = {
  code: PatientIdentityIssueCode;
  message: string;
};

export type PatientIdentityValidationResult =
  | { ok: true; mode: "cuil" | "alternative"; issues: PatientIdentityIssue[] }
  | { ok: false; issues: PatientIdentityIssue[]; error: string };

/** Normalize CUIL/CUIT-like strings to digits only. */
export function normalizeCuilDigits(value: string | null | undefined): string {
  return (value ?? "").replace(/\D+/g, "");
}

/**
 * Structural CUIL check (11 digits + checksum).
 * Does not call AFIP/Ministry APIs.
 */
export function isWellFormedCuil(value: string | null | undefined): boolean {
  const digits = normalizeCuilDigits(value);
  if (!/^\d{11}$/.test(digits)) return false;
  const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += Number(digits[i]) * weights[i];
  }
  const mod = sum % 11;
  const check = mod === 0 ? 0 : mod === 1 ? 9 : 11 - mod;
  return check === Number(digits[10]);
}

export function formatCuilDisplay(value: string | null | undefined): string | null {
  const digits = normalizeCuilDigits(value);
  if (digits.length !== 11) return value?.trim() || null;
  return `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10)}`;
}

export function evaluatePatientIdentityForNationalRx(
  input: PatientIdentityInput
): PatientIdentityValidationResult {
  const issues: PatientIdentityIssue[] = [];

  if (!input.firstName?.trim() || !input.lastName?.trim()) {
    issues.push({ code: "missing_name", message: "Faltan nombre y apellido del paciente." });
  }
  if (!input.documentNumber?.trim()) {
    issues.push({ code: "missing_document", message: "Falta documento del paciente." });
  }
  if (!input.birthDate?.trim()) {
    issues.push({
      code: "missing_birth_date",
      message: "Falta fecha de nacimiento del paciente.",
    });
  }
  if (!input.sex) {
    issues.push({ code: "missing_sex", message: "Falta sexo registral del paciente." });
  }

  const cuilDigits = normalizeCuilDigits(input.cuil);
  if (cuilDigits) {
    if (!isWellFormedCuil(cuilDigits)) {
      issues.push({ code: "malformed_cuil", message: "CUIL malformado." });
    }
  } else {
    const altType = input.altIdentifierType;
    const altValue = input.altIdentifierValue?.trim();
    if (!altType || !altValue) {
      issues.push({
        code: "missing_cuil",
        message:
          "Falta CUIL del paciente. Si no tiene CUIL, cargá un identificador alternativo permitido (CUIT, CDI o pasaporte).",
      });
      issues.push({
        code: "missing_alt_identifier",
        message: "Identificador alternativo incompleto.",
      });
    }
  }

  if (issues.length > 0) {
    return {
      ok: false,
      issues,
      error: issues.map((i) => i.message).join(" "),
    };
  }

  return {
    ok: true,
    mode: cuilDigits ? "cuil" : "alternative",
    issues: [],
  };
}

/** Soft validation for local CRUD — never blocks ordinary patient management. */
export function evaluatePatientIdentitySoft(input: PatientIdentityInput): PatientIdentityIssue[] {
  const issues: PatientIdentityIssue[] = [];
  const cuilDigits = normalizeCuilDigits(input.cuil);
  if (cuilDigits && !isWellFormedCuil(cuilDigits)) {
    issues.push({ code: "malformed_cuil", message: "CUIL malformado (aviso)." });
  }
  return issues;
}
