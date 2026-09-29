import type { ProfessionalValidationResponse, RefepsProfessionalValidationInput } from "@/core/refeps/professional-validation";
import type { NationalRxState } from "@/core/renapdis/national-state-machine";
import type { RetryHooks, RetryPolicy } from "@/core/renapdis/repository/repository-client";
import type { RepositoryConfig } from "@/core/renapdis/repository/repository-config";
import type { RepositoryErrorCode } from "@/core/renapdis/repository/repository-errors";
import type { PrescriptionRepositoryProvider } from "@/core/renapdis/repository/repository-provider";
import type { NationalPrescriptionRequest } from "@/core/renapdis/repository/repository-types";

export const NATIONAL_RX_AUDIT_EVENTS = [
  "refeps_validation_requested",
  "refeps_validation_success",
  "refeps_validation_failed",
  "repository_submission_requested",
  "repository_submission_success",
  "repository_submission_failed",
  "cuir_received",
  "cuir_verified",
  "cuir_verification_failed",
  "national_prescription_blocked",
  "national_prescription_cancelled",
] as const;

export type NationalRxAuditEvent = (typeof NATIONAL_RX_AUDIT_EVENTS)[number];

/** Only identifiers and statuses — never prescription content, diagnosis, document numbers or secrets. */
export type NationalRxAuditMetadata = {
  clinic_id: string;
  prescription_id: string;
  professional_id: string | null;
  provider: string | null;
  status: string;
  correlation_id: string | null;
  error_code?: string | null;
  attempts?: number;
  mode?: string | null;
  timestamp: string;
};

export type NationalRxRecord = {
  id: string;
  clinicId: string;
  status: string;
  professionalId: string | null;
  patientId: string | null;
  nationalState: NationalRxState | null;
  nationalUpdatedAt: string | null;
  submissionId: string | null;
  idempotencyKey: string | null;
  correlationId: string | null;
  attempts: number;
  repositoryProvider: string | null;
  repositoryMode: "sandbox" | "external" | null;
  repositoryPrescriptionId: string | null;
  repositoryStatus: string | null;
  sandboxReference: string | null;
  cuir: string | null;
  errorCode: string | null;
  refepsProfessionalStatus: string | null;
  refepsValidationMode: string | null;
};

/** DB column names (snake_case) of the national columns only. */
export type NationalRxPatch = Partial<{
  national_rx_state: NationalRxState;
  national_submission_id: string;
  national_idempotency_key: string;
  national_correlation_id: string;
  national_attempts: number;
  repository_provider: string | null;
  repository_mode: "sandbox" | "external" | null;
  repository_prescription_id: string | null;
  provider_request_id: string | null;
  repository_status: string | null;
  repository_submitted_at: string | null;
  repository_last_checked_at: string | null;
  repository_error_code: string | null;
  repository_error_message: string | null;
  sandbox_reference: string | null;
  cuir: string | null;
  cuir_received_at: string | null;
  cuir_verified_at: string | null;
  refeps_professional_status: string | null;
  refeps_validation_mode: string | null;
  refeps_validated_at: string | null;
}>;

export interface NationalRxStore {
  load(prescriptionId: string, clinicId: string): Promise<NationalRxRecord | null>;
  /** Compare-and-set on `national_rx_updated_at`; returns null when another request won the race. */
  update(
    prescriptionId: string,
    clinicId: string,
    expectedUpdatedAt: string | null,
    patch: NationalRxPatch
  ): Promise<NationalRxRecord | null>;
}

export type SubmissionBuildResult =
  | { ok: true; request: NationalPrescriptionRequest; refepsInput: RefepsProfessionalValidationInput }
  | { ok: false; code: Extract<RepositoryErrorCode, "invalid_prescription" | "invalid_patient" | "invalid_professional" | "invalid_establishment"> };

export interface NationalRxDataSource {
  buildSubmission(record: NationalRxRecord, submissionId: string, establishmentCode: string): Promise<SubmissionBuildResult>;
}

export type NationalRxActor = { clinicId: string; userId: string };

/** Resolved server-side from the session — never from client input. */
export type NationalRxGates = {
  hasPermission: boolean;
  productEntitled: boolean;
  featureEnabled: boolean;
  mfaElevated: boolean;
  establishmentCode: string | null;
};

export type NationalRxDeps = {
  store: NationalRxStore;
  data: NationalRxDataSource;
  audit: (event: NationalRxAuditEvent, metadata: NationalRxAuditMetadata) => Promise<void>;
  provider: PrescriptionRepositoryProvider;
  repositoryConfig: RepositoryConfig;
  validateProfessional: (input: RefepsProfessionalValidationInput) => Promise<ProfessionalValidationResponse>;
  now?: () => Date;
  uuid: () => string;
  retryPolicy?: RetryPolicy;
  retryHooks?: RetryHooks;
  /** A pending state older than this is considered interrupted and recoverable. */
  staleAfterMs?: number;
};

export type NationalRxBlockCode =
  | "permission_denied"
  | "plan_not_entitled"
  | "feature_disabled"
  | "mfa_required"
  | "establishment_missing"
  | "not_found"
  | "not_issued"
  | "cancelled"
  | "refeps_unavailable"
  | "professional_invalid"
  | "official_validation_required"
  | "in_progress"
  | "invalid_state"
  | RepositoryErrorCode;

export type NationalRxResult =
  | {
      ok: true;
      outcome: "registered_sandbox" | "registered" | "cuir_assigned" | "already_registered" | "cancelled" | "status_refreshed";
      state: NationalRxState;
      sandboxReference: string | null;
      cuir: string | null;
    }
  | {
      ok: false;
      code: NationalRxBlockCode;
      message: string;
      state: NationalRxState | null;
      /** True when the prescription can safely be resubmitted later. */
      recoverable: boolean;
    };
