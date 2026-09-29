/**
 * Normalized NexClinic DTOs for ReNaPDiS-compatible prescription repositories.
 * Vendor schemas live ONLY inside provider adapters (NexClinic DTO → vendor → NexClinic DTO).
 */

import type { RepositoryErrorCode } from "@/core/renapdis/repository/repository-errors";

export type RepositoryProviderMode = "sandbox" | "external" | "not_configured";

export type RepositoryAuthMode = "oauth2_client_credentials" | "jwt_bearer" | "mtls" | "api_key";

export type RepositoryCallContext = {
  /** Stable per logical submission — providers must forward it as their idempotency header/field. */
  idempotencyKey: string;
  /** Per-request correlation id for tracing across NexClinic ↔ provider logs (no PHI). */
  correlationId: string;
  /** Hard timeout for a single HTTP attempt. */
  timeoutMs: number;
};

export type NationalPrescriptionMedicationItem = {
  genericName: string;
  presentation: string | null;
  quantity: number;
  posology: string;
};

/**
 * Minimum data a repository needs to register a prescription.
 * Contains PHI by necessity — never log or audit this object.
 */
export type NationalPrescriptionRequest = {
  submissionId: string;
  prescriptionId: string;
  prescriptionNumber: string | null;
  issuedAt: string;
  validityDays: number;
  category: string;
  establishment: {
    code: string;
  };
  professional: {
    refepsProfessionalId: string | null;
    documentNumber: string | null;
    licenseNumber: string;
    licenseJurisdiction: string | null;
    profession: string | null;
  };
  patient: {
    documentType: string;
    documentNumber: string | null;
    cuil: string | null;
    firstName: string;
    lastName: string;
    birthDate: string | null;
    sex: string | null;
    coverage: { provider: string | null; memberNumber: string | null } | null;
  };
  diagnosis: { code: string | null; system: "CIE-10" | null; text: string | null };
  items: NationalPrescriptionMedicationItem[];
};

export type RepositoryRegistrationStatus = "registered" | "pending" | "rejected" | "cancelled";

/**
 * Official responses may carry a CUIR. Sandbox responses carry ONLY a sandbox reference —
 * the type makes it impossible to return a CUIR from sandbox.
 */
export type NationalPrescriptionResponse =
  | {
      mode: "external";
      providerId: string;
      repositoryPrescriptionId: string;
      providerRequestId: string | null;
      status: RepositoryRegistrationStatus;
      /** Present only when the repository has assigned it. Validated as Anexo IV numeric before persisting. */
      cuir: string | null;
    }
  | {
      mode: "sandbox";
      providerId: string;
      repositoryPrescriptionId: string;
      providerRequestId: string | null;
      status: RepositoryRegistrationStatus;
      sandboxReference: string;
    };

export type CuirStatusResponse = {
  providerId: string;
  repositoryPrescriptionId: string;
  status: RepositoryRegistrationStatus;
  cuir: string | null;
  checkedAt: string;
};

export type CuirVerificationResponse = {
  providerId: string;
  cuir: string;
  valid: boolean;
  status: RepositoryRegistrationStatus | "unknown";
  checkedAt: string;
};

export type CancelPrescriptionResponse = {
  providerId: string;
  repositoryPrescriptionId: string;
  cancelled: boolean;
};

export type ProviderError = {
  code: RepositoryErrorCode;
  retryable: boolean;
  userMessage: string;
  providerRequestId: string | null;
};
