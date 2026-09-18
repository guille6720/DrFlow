/**
 * ReNaPDiS / REFEPS professional validation types (Phase 1).
 *
 * Official Ministry endpoints, credentials, response formats, and CUIR algorithms
 * are NOT invented here. Adapters are pluggable for when specs are provided.
 */

export const REFEPS_VALIDATION_STATUSES = [
  "sandbox",
  "validated",
  "pending",
  "failed",
  "not_configured",
] as const;

export type RefepsValidationStatus = (typeof REFEPS_VALIDATION_STATUSES)[number];

/** Statuses that authorize national electronic prescription submission in Phase 1. */
export const REFEPS_STATUSES_ALLOWING_NATIONAL_RX: ReadonlySet<RefepsValidationStatus> = new Set([
  "sandbox",
  "validated",
]);

export type PrescriberIdentityInput = {
  professionalId: string;
  clinicId: string;
  displayName: string | null;
  cuil: string | null;
  /** Fallback CUIL/CUIT from billing field when cuil is empty. */
  taxId: string | null;
  licenseNumber: string | null;
  licenseNational: string | null;
  licenseProvincial: string | null;
  licensingJurisdiction: string | null;
  issuingAuthority: string | null;
  specialty: string | null;
  refepsIdentifier: string | null;
  currentStatus: RefepsValidationStatus;
};

export type PrescriberValidationIssueCode =
  | "cross_clinic"
  | "invalid_professional"
  | "missing_cuil"
  | "missing_license"
  | "refeps_not_configured"
  | "refeps_pending"
  | "refeps_failed"
  | "refeps_validation_failure"
  | "mfa_missing"
  | "mfa_not_elevated"
  | "identity_incomplete";

export type PrescriberValidationIssue = {
  code: PrescriberValidationIssueCode;
  message: string;
};

export type ValidatePrescriberResult =
  | {
      ok: true;
      status: RefepsValidationStatus;
      issues: PrescriberValidationIssue[];
      details: Record<string, unknown>;
    }
  | {
      ok: false;
      status: RefepsValidationStatus;
      issues: PrescriberValidationIssue[];
      details: Record<string, unknown>;
      error: string;
    };

export type RefepsProfessionalValidationAdapterResult = {
  /** Resulting status after adapter run. */
  status: Extract<RefepsValidationStatus, "sandbox" | "validated" | "failed" | "pending" | "not_configured">;
  error?: string | null;
  details?: Record<string, unknown>;
};

export type RefepsProfessionalValidationAdapter = {
  readonly id: string;
  validate(
    input: PrescriberIdentityInput
  ): Promise<RefepsProfessionalValidationAdapterResult>;
};

export function isRefepsValidationStatus(value: unknown): value is RefepsValidationStatus {
  return (
    typeof value === "string" &&
    (REFEPS_VALIDATION_STATUSES as readonly string[]).includes(value)
  );
}

export function allowsNationalElectronicPrescription(
  status: RefepsValidationStatus
): boolean {
  return REFEPS_STATUSES_ALLOWING_NATIONAL_RX.has(status);
}

export function resolveEffectiveCuil(input: Pick<PrescriberIdentityInput, "cuil" | "taxId">): string {
  return (input.cuil?.trim() || input.taxId?.trim() || "").replace(/\s+/g, "");
}

export function hasAnyProfessionalLicense(
  input: Pick<
    PrescriberIdentityInput,
    "licenseNumber" | "licenseNational" | "licenseProvincial"
  >
): boolean {
  return Boolean(
    input.licenseNational?.trim() ||
      input.licenseProvincial?.trim() ||
      input.licenseNumber?.trim()
  );
}
