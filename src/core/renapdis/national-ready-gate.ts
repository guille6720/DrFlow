import type { PrescriberMfaStatus } from "@/core/auth/prescriber-mfa.types";
import type { CuirStatus } from "@/core/renapdis/cuir";
import { type CuirComponents, validateCuirComponents } from "@/core/renapdis/cuir";
import {
  evaluatePatientIdentityForNationalRx,
  type PatientIdentityInput,
} from "@/core/renapdis/patient-identity";
import {
  evaluatePrescriptionIssueGate,
  type PrescriptionIssueGateResult,
} from "@/core/renapdis/prescription-issue-gate";
import type { PrescriberIdentityInput, PrescriberValidationIssue } from "@/core/renapdis/types";

export type NationalRxStatus =
  | "local"
  | "sandbox"
  | "national_ready"
  | "submitted"
  | "failed";

export type NationalReadyGateInput = {
  authenticated: boolean;
  clinicMember: boolean;
  hasIssuePermission: boolean;
  mfa: Pick<PrescriberMfaStatus, "enrolled" | "elevated">;
  professional: PrescriberIdentityInput | null;
  patient: PatientIdentityInput | null;
  prescription: {
    hasDiagnosis: boolean;
    hasMedicationsOrItems: boolean;
    issueDatePresent: boolean;
  };
  cuir: {
    status: CuirStatus;
    components: Partial<CuirComponents>;
  };
  /** Official DNSISA platform/repository ids when available. */
  officialIds?: {
    platformId?: string | null;
    repositoryId?: string | null;
  };
};

export type NationalReadyGateResult =
  | { ok: true; nationalRxStatus: Extract<NationalRxStatus, "sandbox" | "national_ready"> }
  | {
      ok: false;
      nationalRxStatus: "failed";
      error: string;
      code: string;
      issues: Array<PrescriberValidationIssue | { code: string; message: string }>;
      phase1?: PrescriptionIssueGateResult;
    };

/**
 * Phase 2 gate: prerequisites for considering a prescription national_ready / sandbox.
 * Does not replace Phase 1 local issuance (which stays on channel=local).
 */
export function evaluateNationalReadyGate(input: NationalReadyGateInput): NationalReadyGateResult {
  const phase1 = evaluatePrescriptionIssueGate({
    authenticated: input.authenticated,
    clinicMember: input.clinicMember,
    hasIssuePermission: input.hasIssuePermission,
    mfa: input.mfa,
    professional: input.professional,
    channel: "national_electronic",
  });

  if (!phase1.ok) {
    return {
      ok: false,
      nationalRxStatus: "failed",
      error: phase1.error,
      code: phase1.code,
      issues: phase1.issues,
      phase1,
    };
  }

  if (!input.patient) {
    return {
      ok: false,
      nationalRxStatus: "failed",
      error: "Paciente inválido para receta nacional.",
      code: "invalid_patient",
      issues: [{ code: "invalid_patient", message: "Paciente inválido." }],
    };
  }

  const patientId = evaluatePatientIdentityForNationalRx(input.patient);
  if (!patientId.ok) {
    return {
      ok: false,
      nationalRxStatus: "failed",
      error: patientId.error,
      code: patientId.issues[0]?.code ?? "patient_identity",
      issues: patientId.issues,
    };
  }

  if (!input.prescription.hasDiagnosis) {
    return {
      ok: false,
      nationalRxStatus: "failed",
      error: "Falta diagnóstico para receta nacional.",
      code: "missing_diagnosis",
      issues: [{ code: "missing_diagnosis", message: "Diagnóstico requerido." }],
    };
  }
  if (!input.prescription.hasMedicationsOrItems) {
    return {
      ok: false,
      nationalRxStatus: "failed",
      error: "Faltan ítems de la receta.",
      code: "missing_items",
      issues: [{ code: "missing_items", message: "Ítems requeridos." }],
    };
  }
  if (!input.prescription.issueDatePresent) {
    return {
      ok: false,
      nationalRxStatus: "failed",
      error: "Falta fecha de emisión.",
      code: "missing_issue_date",
      issues: [{ code: "missing_issue_date", message: "Fecha de emisión requerida." }],
    };
  }

  const jurisdiction =
    input.professional?.licensingJurisdiction?.trim() ||
    input.cuir.components.jurisdiction?.trim() ||
    "";
  if (!jurisdiction) {
    return {
      ok: false,
      nationalRxStatus: "failed",
      error: "Falta jurisdicción de matrícula del profesional.",
      code: "missing_jurisdiction",
      issues: [
        {
          code: "missing_jurisdiction",
          message: "Jurisdicción profesional requerida.",
        },
      ],
    };
  }

  const cuirResult = validateCuirComponents({
    status: input.cuir.status,
    components: {
      ...input.cuir.components,
      jurisdiction: input.cuir.components.jurisdiction || jurisdiction,
      platformId:
        input.cuir.components.platformId ||
        input.officialIds?.platformId ||
        undefined,
      repositoryId:
        input.cuir.components.repositoryId ||
        input.officialIds?.repositoryId ||
        undefined,
    },
  });

  if (!cuirResult.ok) {
    return {
      ok: false,
      nationalRxStatus: "failed",
      error: cuirResult.error,
      code: cuirResult.issues[0]?.code ?? "cuir_validation_failure",
      issues: cuirResult.issues,
    };
  }

  if (cuirResult.status === "sandbox") {
    return { ok: true, nationalRxStatus: "sandbox" };
  }

  return { ok: true, nationalRxStatus: "national_ready" };
}
