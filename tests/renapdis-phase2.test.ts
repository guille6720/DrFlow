import { describe, expect, it } from "vitest";

import {
  assertFhirBundleShape,
  buildDrFlowFhirBundle,
} from "@/core/interoperability/fhir";
import {
  buildSandboxCuirComponents,
  formatCuir,
  parseCuir,
  resolveCuirEnvironment,
  SANDBOX_CUIR_PLATFORM_PLACEHOLDER,
  validateCuirComponents,
} from "@/core/renapdis/cuir";
import { evaluateNationalReadyGate } from "@/core/renapdis/national-ready-gate";
import {
  evaluatePatientIdentityForNationalRx,
  evaluatePatientIdentitySoft,
  isWellFormedCuil,
} from "@/core/renapdis/patient-identity";
import { evaluatePrescriptionIssueGate } from "@/core/renapdis/prescription-issue-gate";
import {
  mapLegacyPrescriptionTypeToCategory,
  mapLegacyPrescriptionTypeToSubtype,
} from "@/core/renapdis/prescription-types";
import type { PrescriberIdentityInput } from "@/core/renapdis/types";
import { mapFreeTextTerminology } from "@/core/terminology/snomed";

/** Structurally valid CUIL digits for unit tests (checksum via same algorithm as product code). */
function makeValidCuilDigits(): string {
  const base = "2012345678";
  const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 10; i++) sum += Number(base[i]) * weights[i];
  const mod = sum % 11;
  const check = mod === 0 ? 0 : mod === 1 ? 9 : 11 - mod;
  return `${base}${check}`;
}

const VALID_CUIL = makeValidCuilDigits();

function baseProfessional(
  overrides: Partial<PrescriberIdentityInput> = {}
): PrescriberIdentityInput {
  return {
    professionalId: "pro-1",
    clinicId: "clinic-a",
    displayName: "Dra. Demo",
    cuil: VALID_CUIL,
    taxId: null,
    licenseNumber: null,
    licenseNational: "MN12345",
    licenseProvincial: null,
    licensingJurisdiction: "CABA",
    issuingAuthority: "Ministerio de Salud CABA",
    specialty: "Clínica médica",
    refepsIdentifier: "REFEPS-PLACEHOLDER",
    currentStatus: "sandbox",
    ...overrides,
  };
}

function basePatient(
  overrides: Partial<Parameters<typeof evaluatePatientIdentityForNationalRx>[0]> = {}
) {
  return {
    patientId: "pat-1",
    clinicId: "clinic-a",
    firstName: "Ana",
    lastName: "Pérez",
    documentNumber: "30111222",
    documentType: "dni" as const,
    cuil: VALID_CUIL,
    altIdentifierType: null,
    altIdentifierValue: null,
    birthDate: "1990-01-15",
    sex: "F" as const,
    insuranceProvider: "OSDE",
    address: "Calle 1",
    ...overrides,
  };
}

describe("ReNaPDiS Phase 2 — patient identity", () => {
  it("accepts patient with valid CUIL", () => {
    expect(isWellFormedCuil(VALID_CUIL)).toBe(true);
    const result = evaluatePatientIdentityForNationalRx(basePatient());
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.mode).toBe("cuil");
  });

  it("rejects patient without CUIL and without alternative", () => {
    const result = evaluatePatientIdentityForNationalRx(basePatient({ cuil: null }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((i) => i.code === "missing_cuil")).toBe(true);
    }
  });

  it("accepts foreign patient with allowed alternative identifier", () => {
    const result = evaluatePatientIdentityForNationalRx(
      basePatient({
        cuil: null,
        documentType: "passport",
        altIdentifierType: "passport",
        altIdentifierValue: "X1234567",
      })
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.mode).toBe("alternative");
  });

  it("rejects malformed CUIL", () => {
    expect(isWellFormedCuil("20-12345678-0")).toBe(false);
    const result = evaluatePatientIdentityForNationalRx(
      basePatient({ cuil: "20-12345678-0" })
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((i) => i.code === "malformed_cuil")).toBe(true);
    }
  });

  it("rejects missing birth date for national rx", () => {
    const result = evaluatePatientIdentityForNationalRx(basePatient({ birthDate: null }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((i) => i.code === "missing_birth_date")).toBe(true);
    }
  });

  it("rejects missing identity fields for national rx", () => {
    const result = evaluatePatientIdentityForNationalRx(
      basePatient({ firstName: "", lastName: "", sex: null })
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.map((i) => i.code)).toEqual(
        expect.arrayContaining(["missing_name", "missing_sex"])
      );
    }
  });

  it("soft validation does not block local incomplete identity", () => {
    const issues = evaluatePatientIdentitySoft(
      basePatient({ cuil: null, birthDate: null, sex: null })
    );
    expect(issues).toEqual([]);
  });

  it("documents cross-clinic isolation expectation via clinicId mismatch", () => {
    const other = basePatient({ clinicId: "clinic-b" });
    expect(other.clinicId).not.toBe("clinic-a");
  });
});

describe("ReNaPDiS Phase 2 — CUIR", () => {
  it("formats and parses six components", () => {
    const components = buildSandboxCuirComponents({
      jurisdiction: "CABA",
      typeSubtype: "medication:ambulatory",
      groupId: "ABC123",
      itemNumber: "1",
    });
    const formatted = formatCuir(components);
    expect(formatted.split("|")).toHaveLength(6);
    expect(parseCuir(formatted)).toEqual(components);
  });

  it("marks sandbox status and never treats as official", () => {
    expect(resolveCuirEnvironment({ allowSandbox: true })).toBe("sandbox");
    const components = buildSandboxCuirComponents({
      jurisdiction: "CABA",
      typeSubtype: "MED",
      groupId: "G1",
    });
    const ok = validateCuirComponents({ status: "sandbox", components });
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.status).toBe("sandbox");
      expect(ok.components.platformId).toBe(SANDBOX_CUIR_PLATFORM_PLACEHOLDER);
    }
  });

  it("blocks official mode when official identifiers absent / sandbox placeholders", () => {
    expect(resolveCuirEnvironment({})).toBe("pending_official_ids");
    const pending = validateCuirComponents({
      status: "pending_official_ids",
      components: buildSandboxCuirComponents({
        jurisdiction: "CABA",
        typeSubtype: "MED",
        groupId: "G1",
      }),
    });
    expect(pending.ok).toBe(false);

    const officialWithSandbox = validateCuirComponents({
      status: "official",
      components: buildSandboxCuirComponents({
        jurisdiction: "CABA",
        typeSubtype: "MED",
        groupId: "G1",
      }),
    });
    expect(officialWithSandbox.ok).toBe(false);
    if (!officialWithSandbox.ok) {
      expect(officialWithSandbox.issues.some((i) => i.code === "official_ids_absent")).toBe(
        true
      );
    }
  });
});

describe("ReNaPDiS Phase 2 — prescription types", () => {
  it("maps legacy types without inventing national numeric codes", () => {
    expect(mapLegacyPrescriptionTypeToCategory("ambulatoria")).toBe("medication");
    expect(mapLegacyPrescriptionTypeToSubtype("cronica")).toBe("chronic");
    expect(mapLegacyPrescriptionTypeToSubtype("duplicado")).toBe("duplicated_controlled");
  });
});

describe("ReNaPDiS Phase 2 — national gate vs local", () => {
  it("blocks national_ready when patient prerequisites fail", () => {
    const result = evaluateNationalReadyGate({
      authenticated: true,
      clinicMember: true,
      hasIssuePermission: true,
      mfa: { enrolled: true, elevated: true },
      professional: baseProfessional(),
      patient: basePatient({ cuil: null, altIdentifierType: null, altIdentifierValue: null }),
      prescription: {
        hasDiagnosis: true,
        hasMedicationsOrItems: true,
        issueDatePresent: true,
      },
      cuir: {
        status: "sandbox",
        components: buildSandboxCuirComponents({
          jurisdiction: "CABA",
          typeSubtype: "medication:ambulatory",
          groupId: "G1",
        }),
      },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.nationalRxStatus).toBe("failed");
  });

  it("allows sandbox national readiness when prerequisites pass", () => {
    const result = evaluateNationalReadyGate({
      authenticated: true,
      clinicMember: true,
      hasIssuePermission: true,
      mfa: { enrolled: true, elevated: true },
      professional: baseProfessional(),
      patient: basePatient(),
      prescription: {
        hasDiagnosis: true,
        hasMedicationsOrItems: true,
        issueDatePresent: true,
      },
      cuir: {
        status: "sandbox",
        components: buildSandboxCuirComponents({
          jurisdiction: "CABA",
          typeSubtype: "medication:ambulatory",
          groupId: "G1",
        }),
      },
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.nationalRxStatus).toBe("sandbox");
  });

  it("keeps local channel functional without patient CUIL", () => {
    const local = evaluatePrescriptionIssueGate({
      authenticated: true,
      clinicMember: true,
      hasIssuePermission: true,
      mfa: { enrolled: true, elevated: true },
      professional: baseProfessional(),
      channel: "local",
    });
    expect(local.ok).toBe(true);
  });
});

describe("ReNaPDiS Phase 2 — FHIR + SNOMED preparation", () => {
  it("serializes FHIR preparation bundle with shape checks", () => {
    const bundle = buildDrFlowFhirBundle({
      patient: {
        id: "pat-1",
        firstName: "Ana",
        lastName: "Pérez",
        documentNumber: "30111222",
        cuil: VALID_CUIL,
        sex: "F",
        birthDate: "1990-01-15",
        address: "Calle 1",
      },
      practitioner: {
        id: "pro-1",
        fullName: "Dra. Demo",
        license: "MN12345",
        refepsIdentifier: "REFEPS-PLACEHOLDER",
      },
      prescription: {
        id: "rx-1",
        issuedAt: "2026-03-25T12:00:00.000Z",
        diagnosisText: "Hipertensión",
        medications: [
          {
            genericName: "Enalapril",
            quantity: 30,
            posology: "1/día",
            presentation: "10 mg",
          },
        ],
      },
      coverage: { provider: "OSDE", number: "123" },
      cuir: {
        status: "sandbox",
        components: buildSandboxCuirComponents({
          jurisdiction: "CABA",
          typeSubtype: "medication:ambulatory",
          groupId: "G1",
        }),
        formatted: "SBX-PLATFORM|SBX-REPO|CABA|medication:ambulatory|G1|1",
      },
    });
    expect(assertFhirBundleShape(bundle)).toEqual([]);
    expect(bundle.drflow?.legalValidity).toBe("sandbox_only");
    expect(bundle.entry.some((e) => e.resource.resourceType === "Patient")).toBe(true);
    expect(bundle.entry.some((e) => e.resource.resourceType === "MedicationRequest")).toBe(
      true
    );
  });

  it("SNOMED unmapped fallback preserves free text", async () => {
    const coding = await mapFreeTextTerminology({
      domain: "diagnosis",
      freeText: "Hipertensión esencial",
    });
    expect(coding.status).toBe("unmapped");
    expect(coding.code).toBeNull();
    expect(coding.originalText).toBe("Hipertensión esencial");
  });
});

describe("ReNaPDiS Phase 2 — audit event tags", () => {
  it("documents expected audit event names for Phase 2 readiness", () => {
    const events = [
      "patient_identity_validation",
      "patient_identity_failure",
      "cuir_preparation",
      "cuir_generation",
      "cuir_validation_failure",
      "national_prescription_blocked",
      "fhir_payload_generated",
      "terminology_mapping_attempt",
    ];
    expect(new Set(events).size).toBe(events.length);
  });
});
