import type { PrescriberMfaStatus } from "@/core/auth/prescriber-mfa.types";
import type {
  PrescriberIdentityInput,
  PrescriberValidationIssue,
  ValidatePrescriberResult,
} from "@/core/renapdis/types";
import { evaluateNationalPrescriptionEligibility } from "@/core/renapdis/validate-prescriber";

export type PrescriptionIssueChannel = "local" | "national_electronic";

export type PrescriptionIssueGateInput = {
  authenticated: boolean;
  clinicMember: boolean;
  hasIssuePermission: boolean;
  mfa: Pick<PrescriberMfaStatus, "enrolled" | "elevated">;
  professional: PrescriberIdentityInput | null;
  channel: PrescriptionIssueChannel;
};

export type PrescriptionIssueGateResult =
  | { ok: true; nationalEligibility?: ValidatePrescriberResult }
  | {
      ok: false;
      error: string;
      code: PrescriberValidationIssue["code"] | "unauthenticated" | "not_clinic_member" | "permission_denied";
      issues: PrescriberValidationIssue[];
    };

/**
 * Pure orchestration of Phase 1 issuance checks.
 * Server actions still perform real auth/membership/MFA; this encodes the policy for tests.
 */
export function evaluatePrescriptionIssueGate(
  input: PrescriptionIssueGateInput
): PrescriptionIssueGateResult {
  if (!input.authenticated) {
    return {
      ok: false,
      code: "unauthenticated",
      error: "Sesión requerida.",
      issues: [],
    };
  }
  if (!input.clinicMember) {
    return {
      ok: false,
      code: "not_clinic_member",
      error: "Debés ser miembro de la clínica activa.",
      issues: [],
    };
  }
  if (!input.hasIssuePermission) {
    return {
      ok: false,
      code: "permission_denied",
      error: "Sin permiso para emitir recetas.",
      issues: [],
    };
  }
  if (!input.mfa.enrolled) {
    return {
      ok: false,
      code: "mfa_missing",
      error: "Debés activar MFA (TOTP) antes de emitir recetas.",
      issues: [{ code: "mfa_missing", message: "MFA no enrolado." }],
    };
  }
  if (!input.mfa.elevated) {
    return {
      ok: false,
      code: "mfa_not_elevated",
      error: "Confirmá MFA para elevar la sesión (AAL2) antes de emitir.",
      issues: [{ code: "mfa_not_elevated", message: "Sesión MFA no elevada." }],
    };
  }
  if (!input.professional) {
    return {
      ok: false,
      code: "invalid_professional",
      error: "Profesional prescritor inválido.",
      issues: [{ code: "invalid_professional", message: "Profesional inválido." }],
    };
  }

  if (input.channel === "local") {
    return { ok: true };
  }

  const national = evaluateNationalPrescriptionEligibility(input.professional);
  if (!national.ok) {
    return {
      ok: false,
      code: national.issues[0]?.code ?? "refeps_validation_failure",
      error: national.error,
      issues: national.issues,
    };
  }
  return { ok: true, nationalEligibility: national };
}
