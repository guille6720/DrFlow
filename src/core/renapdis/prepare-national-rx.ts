/**
 * Prepare national e-Rx readiness artifacts (CUIR sandbox / FHIR meta / terminology).
 * Never invents official DNSISA platform/repository identifiers.
 */

import { buildDrFlowFhirBundle } from "@/core/interoperability/fhir";
import {
  buildSandboxCuirComponents,
  type CuirComponents,
  type CuirStatus,
  formatCuir,
  resolveCuirEnvironment,
  validateCuirComponents,
} from "@/core/renapdis/cuir";
import type { NationalReadyGateInput, NationalRxStatus } from "@/core/renapdis/national-ready-gate";
import { evaluateNationalReadyGate } from "@/core/renapdis/national-ready-gate";
import {
  mapLegacyPrescriptionTypeToCategory,
  mapLegacyPrescriptionTypeToSubtype,
} from "@/core/renapdis/prescription-types";
import { mapFreeTextTerminology } from "@/core/terminology/snomed";

export type PrepareNationalRxInput = NationalReadyGateInput & {
  prescriptionId: string;
  prescriptionType?: string | null;
  diagnosisText: string | null;
  medications: Array<{
    genericName: string;
    quantity: number;
    posology: string;
    presentation?: string | null;
  }>;
  patientForFhir: {
    id: string;
    firstName: string;
    lastName: string;
    documentNumber: string;
    cuil: string | null;
    sex: string | null;
    birthDate: string | null;
    address: string | null;
  };
  practitionerForFhir: {
    id: string;
    fullName: string;
    license: string | null;
    refepsIdentifier: string | null;
  };
  coverage?: { provider: string | null; number: string | null } | null;
  issuedAt: string | null;
  allowSandbox?: boolean;
};

export type PrepareNationalRxResult =
  | {
      ok: true;
      nationalRxStatus: Extract<NationalRxStatus, "sandbox" | "national_ready">;
      cuirStatus: CuirStatus;
      cuirComponents: CuirComponents;
      cuirFormatted: string;
      prescriptionCategory: string;
      prescriptionSubtype: string;
      diagnosisCoding: Awaited<ReturnType<typeof mapFreeTextTerminology>>;
      fhirBundle: ReturnType<typeof buildDrFlowFhirBundle>;
      auditEvents: string[];
    }
  | {
      ok: false;
      nationalRxStatus: "failed";
      error: string;
      code: string;
      auditEvents: string[];
    };

export async function prepareNationalRxArtifacts(
  input: PrepareNationalRxInput
): Promise<PrepareNationalRxResult> {
  const auditEvents: string[] = [];
  const allowSandbox = input.allowSandbox !== false;

  const env = resolveCuirEnvironment({
    officialPlatformId: input.officialIds?.platformId,
    officialRepositoryId: input.officialIds?.repositoryId,
    allowSandbox,
  });

  const category = mapLegacyPrescriptionTypeToCategory(input.prescriptionType);
  const subtype = mapLegacyPrescriptionTypeToSubtype(input.prescriptionType);
  const typeSubtype = `${category}:${subtype}`;

  let components: Partial<CuirComponents>;
  let cuirStatus: CuirStatus = env;

  if (env === "sandbox") {
    components = buildSandboxCuirComponents({
      jurisdiction:
        input.professional?.licensingJurisdiction?.trim() ||
        input.cuir.components.jurisdiction ||
        "XX",
      typeSubtype,
      groupId: input.prescriptionId.replace(/-/g, "").slice(0, 16).toUpperCase(),
      itemNumber: "1",
    });
    cuirStatus = "sandbox";
    auditEvents.push("cuir_preparation");
  } else if (env === "official") {
    components = {
      platformId: input.officialIds?.platformId?.trim() || undefined,
      repositoryId: input.officialIds?.repositoryId?.trim() || undefined,
      jurisdiction: input.professional?.licensingJurisdiction?.trim() || undefined,
      typeSubtype,
      groupId: input.prescriptionId.replace(/-/g, "").slice(0, 16).toUpperCase(),
      itemNumber: "1",
    };
    cuirStatus = "official";
    auditEvents.push("cuir_preparation");
  } else {
    components = {
      jurisdiction: input.professional?.licensingJurisdiction?.trim() || undefined,
      typeSubtype,
      groupId: input.prescriptionId.replace(/-/g, "").slice(0, 16).toUpperCase(),
      itemNumber: "1",
    };
    cuirStatus = "pending_official_ids";
  }

  const gate = evaluateNationalReadyGate({
    ...input,
    cuir: { status: cuirStatus, components },
  });

  if (!gate.ok) {
    auditEvents.push("national_prescription_blocked");
    if (gate.code.includes("cuir") || gate.code === "official_ids_absent") {
      auditEvents.push("cuir_validation_failure");
    }
    if (gate.code.includes("patient") || gate.code.includes("cuil") || gate.code.includes("birth")) {
      auditEvents.push("patient_identity_failure");
    }
    return {
      ok: false,
      nationalRxStatus: "failed",
      error: gate.error,
      code: gate.code,
      auditEvents,
    };
  }

  const cuirValidated = validateCuirComponents({ status: cuirStatus, components });
  if (!cuirValidated.ok) {
    auditEvents.push("cuir_validation_failure", "national_prescription_blocked");
    return {
      ok: false,
      nationalRxStatus: "failed",
      error: cuirValidated.error,
      code: cuirValidated.issues[0]?.code ?? "cuir_validation_failure",
      auditEvents,
    };
  }

  auditEvents.push("cuir_generation", "patient_identity_validation");

  const diagnosisCoding = await mapFreeTextTerminology({
    domain: "diagnosis",
    freeText: input.diagnosisText ?? "",
  });
  auditEvents.push("terminology_mapping_attempt");

  const fhirBundle = buildDrFlowFhirBundle({
    patient: input.patientForFhir,
    practitioner: input.practitionerForFhir,
    prescription: {
      id: input.prescriptionId,
      issuedAt: input.issuedAt,
      diagnosisText: input.diagnosisText,
      diagnosisCoding,
      medications: input.medications,
    },
    coverage: input.coverage,
    cuir: {
      status: cuirValidated.status,
      components: cuirValidated.components,
      formatted: cuirValidated.formatted,
    },
  });
  auditEvents.push("fhir_payload_generated");

  return {
    ok: true,
    nationalRxStatus: gate.nationalRxStatus,
    cuirStatus: cuirValidated.status,
    cuirComponents: cuirValidated.components,
    cuirFormatted: cuirValidated.formatted || formatCuir(cuirValidated.components),
    prescriptionCategory: category,
    prescriptionSubtype: subtype,
    diagnosisCoding,
    fhirBundle,
    auditEvents,
  };
}
