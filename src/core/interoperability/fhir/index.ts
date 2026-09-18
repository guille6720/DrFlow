/**
 * FHIR-ready interoperability preparation (Phase 2).
 * Internal serializers only — not official DNSISA FHIR conformance.
 */

import type { CuirComponents, CuirStatus } from "@/core/renapdis/cuir";
import type { TerminologyCoding } from "@/core/terminology/snomed";

export type FhirResourceType =
  | "Patient"
  | "Practitioner"
  | "PractitionerRole"
  | "MedicationRequest"
  | "ServiceRequest"
  | "Coverage"
  | "Bundle";

export type FhirCoding = {
  system?: string;
  code?: string;
  display?: string;
};

export type FhirCodeableConcept = {
  coding?: FhirCoding[];
  text?: string;
};

export type DrFlowFhirPatient = {
  resourceType: "Patient";
  id: string;
  identifier: Array<{ system: string; value: string }>;
  name: Array<{ family: string; given: string[] }>;
  gender?: string;
  birthDate?: string;
  address?: Array<{ text: string }>;
};

export type DrFlowFhirPractitioner = {
  resourceType: "Practitioner";
  id: string;
  name: Array<{ text: string }>;
  identifier: Array<{ system: string; value: string }>;
};

export type DrFlowFhirMedicationRequest = {
  resourceType: "MedicationRequest";
  id: string;
  status: string;
  intent: string;
  medicationCodeableConcept: FhirCodeableConcept;
  subject: { reference: string };
  authoredOn?: string;
  dosageInstruction?: Array<{ text: string }>;
  note?: Array<{ text: string }>;
};

export type DrFlowFhirBundle = {
  resourceType: "Bundle";
  type: "collection";
  timestamp: string;
  meta?: {
    tag?: Array<{ system: string; code: string; display: string }>;
  };
  entry: Array<{ resource: Record<string, unknown> }>;
  /** NexClinic extension — not a FHIR official field; kept for staging traceability. */
  drflow?: {
    cuirStatus: CuirStatus;
    cuirFormatted: string | null;
    legalValidity: "none" | "sandbox_only" | "official_pending";
  };
};

export type BuildFhirBundleInput = {
  patient: {
    id: string;
    firstName: string;
    lastName: string;
    documentNumber: string;
    cuil: string | null;
    sex: string | null;
    birthDate: string | null;
    address: string | null;
  };
  practitioner: {
    id: string;
    fullName: string;
    license: string | null;
    refepsIdentifier: string | null;
  };
  prescription: {
    id: string;
    issuedAt: string | null;
    diagnosisText: string | null;
    diagnosisCoding?: TerminologyCoding | null;
    medications: Array<{
      genericName: string;
      quantity: number;
      posology: string;
      presentation?: string | null;
    }>;
  };
  coverage?: { provider: string | null; number: string | null } | null;
  cuir?: { status: CuirStatus; components: CuirComponents | null; formatted: string | null };
};

function mapSexToFhirGender(sex: string | null): string | undefined {
  if (sex === "F") return "female";
  if (sex === "M") return "male";
  if (sex === "X") return "other";
  return undefined;
}

export function buildDrFlowFhirPatient(input: BuildFhirBundleInput["patient"]): DrFlowFhirPatient {
  const identifiers: DrFlowFhirPatient["identifier"] = [
    { system: "urn:drflow:document", value: input.documentNumber },
  ];
  if (input.cuil?.trim()) {
    identifiers.push({ system: "urn:drflow:cuil", value: input.cuil.trim() });
  }
  return {
    resourceType: "Patient",
    id: input.id,
    identifier: identifiers,
    name: [{ family: input.lastName, given: [input.firstName] }],
    gender: mapSexToFhirGender(input.sex),
    birthDate: input.birthDate ?? undefined,
    address: input.address?.trim() ? [{ text: input.address.trim() }] : undefined,
  };
}

export function buildDrFlowFhirPractitioner(
  input: BuildFhirBundleInput["practitioner"]
): DrFlowFhirPractitioner {
  const identifier: DrFlowFhirPractitioner["identifier"] = [];
  if (input.license?.trim()) {
    identifier.push({ system: "urn:drflow:license", value: input.license.trim() });
  }
  if (input.refepsIdentifier?.trim()) {
    identifier.push({ system: "urn:drflow:refeps", value: input.refepsIdentifier.trim() });
  }
  return {
    resourceType: "Practitioner",
    id: input.id,
    name: [{ text: input.fullName }],
    identifier,
  };
}

export function buildDrFlowMedicationRequests(
  prescription: BuildFhirBundleInput["prescription"],
  patientId: string
): DrFlowFhirMedicationRequest[] {
  return prescription.medications.map((med, index) => ({
    resourceType: "MedicationRequest",
    id: `${prescription.id}-med-${index + 1}`,
    status: "active",
    intent: "order",
    medicationCodeableConcept: {
      text: [med.genericName, med.presentation].filter(Boolean).join(" — "),
    },
    subject: { reference: `Patient/${patientId}` },
    authoredOn: prescription.issuedAt ?? undefined,
    dosageInstruction: [{ text: med.posology }],
    note: [{ text: `Cantidad: ${med.quantity}` }],
  }));
}

export function buildDrFlowFhirBundle(input: BuildFhirBundleInput): DrFlowFhirBundle {
  const patient = buildDrFlowFhirPatient(input.patient);
  const practitioner = buildDrFlowFhirPractitioner(input.practitioner);
  const meds = buildDrFlowMedicationRequests(input.prescription, input.patient.id);

  const coverage =
    input.coverage?.provider?.trim()
      ? {
          resourceType: "Coverage",
          id: `coverage-${input.patient.id}`,
          status: "active",
          beneficiary: { reference: `Patient/${input.patient.id}` },
          payor: [{ display: input.coverage.provider }],
          subscriberId: input.coverage.number ?? undefined,
        }
      : null;

  const diagnosisCoding = input.prescription.diagnosisCoding;
  const serviceRequest =
    input.prescription.diagnosisText?.trim()
      ? {
          resourceType: "ServiceRequest",
          id: `dx-${input.prescription.id}`,
          status: "active",
          intent: "order",
          code: {
            text: input.prescription.diagnosisText,
            coding:
              diagnosisCoding?.status === "mapped" && diagnosisCoding.code
                ? [
                    {
                      system: diagnosisCoding.system ?? undefined,
                      code: diagnosisCoding.code,
                      display: diagnosisCoding.display ?? undefined,
                    },
                  ]
                : undefined,
          },
          subject: { reference: `Patient/${input.patient.id}` },
        }
      : null;

  const entries: DrFlowFhirBundle["entry"] = [
    { resource: patient as unknown as Record<string, unknown> },
    { resource: practitioner as unknown as Record<string, unknown> },
    ...meds.map((m) => ({ resource: m as unknown as Record<string, unknown> })),
  ];
  if (coverage) entries.push({ resource: coverage });
  if (serviceRequest) entries.push({ resource: serviceRequest });

  const cuirStatus = input.cuir?.status ?? "pending_official_ids";
  const legalValidity =
    cuirStatus === "official"
      ? "official_pending"
      : cuirStatus === "sandbox"
        ? "sandbox_only"
        : "none";

  return {
    resourceType: "Bundle",
    type: "collection",
    timestamp: new Date().toISOString(),
    meta: {
      tag: [
        {
          system: "urn:drflow:interoperability",
          code: "preparation",
          display: "NexClinic FHIR preparation layer — not official DNSISA conformance",
        },
      ],
    },
    entry: entries,
    drflow: {
      cuirStatus,
      cuirFormatted: input.cuir?.formatted ?? null,
      legalValidity,
    },
  };
}

export function assertFhirBundleShape(bundle: DrFlowFhirBundle): string[] {
  const errors: string[] = [];
  if (bundle.resourceType !== "Bundle") errors.push("resourceType must be Bundle");
  if (!Array.isArray(bundle.entry) || bundle.entry.length === 0) {
    errors.push("entry must be a non-empty array");
  }
  for (const [i, e] of bundle.entry.entries()) {
    if (!e.resource || typeof e.resource !== "object") {
      errors.push(`entry[${i}] missing resource`);
    }
  }
  return errors;
}
