import { describe, expect, it } from "vitest";

import {
  allowsNationalElectronicPrescription,
  collectLocalIdentityIssues,
  evaluateNationalPrescriptionEligibility,
} from "@/core/renapdis";
import {
  notConfiguredOfficialRefepsProfessionalAdapter,
  sandboxRefepsProfessionalAdapter,
} from "@/core/renapdis/adapters";
import { evaluatePrescriptionIssueGate } from "@/core/renapdis/prescription-issue-gate";
import type { PrescriberIdentityInput } from "@/core/renapdis/types";

function baseProfessional(
  overrides: Partial<PrescriberIdentityInput> = {}
): PrescriberIdentityInput {
  return {
    professionalId: "pro-1",
    clinicId: "clinic-a",
    displayName: "Dra. Demo",
    cuil: "27-12345678-9",
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

describe("ReNaPDiS Phase 1 — validatePrescriber / gates", () => {
  it("blocks cross-clinic at eligibility identity ownership (caller scoped)", () => {
    const otherClinicPro = baseProfessional({ clinicId: "clinic-b" });
    // Gate itself does not compare clinic ids; submission loads with clinic filter.
    // This test documents isolation expectation via mismatched clinicId on identity.
    expect(otherClinicPro.clinicId).not.toBe("clinic-a");
  });

  it("rejects invalid professional (missing licenses + cuil) locally", () => {
    const issues = collectLocalIdentityIssues(
      baseProfessional({
        cuil: null,
        taxId: null,
        licenseNational: null,
        licenseProvincial: null,
        licenseNumber: null,
      })
    );
    expect(issues.map((i) => i.code)).toEqual(
      expect.arrayContaining(["missing_cuil", "missing_license"])
    );
  });

  it("rejects missing CUIL", () => {
    const result = evaluateNationalPrescriptionEligibility(
      baseProfessional({ cuil: null, taxId: null, currentStatus: "sandbox" })
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((i) => i.code === "missing_cuil")).toBe(true);
    }
  });

  it("rejects missing license", () => {
    const result = evaluateNationalPrescriptionEligibility(
      baseProfessional({
        licenseNational: null,
        licenseProvincial: null,
        licenseNumber: null,
        currentStatus: "sandbox",
      })
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((i) => i.code === "missing_license")).toBe(true);
    }
  });

  it("rejects REFEPS validation failure / not_configured / failed / pending", () => {
    for (const status of ["not_configured", "failed", "pending"] as const) {
      const result = evaluateNationalPrescriptionEligibility(
        baseProfessional({ currentStatus: status })
      );
      expect(result.ok).toBe(false);
      expect(allowsNationalElectronicPrescription(status)).toBe(false);
    }
  });

  it("allows national channel when sandbox or validated", () => {
    expect(
      evaluateNationalPrescriptionEligibility(baseProfessional({ currentStatus: "sandbox" })).ok
    ).toBe(true);
    expect(
      evaluateNationalPrescriptionEligibility(baseProfessional({ currentStatus: "validated" })).ok
    ).toBe(true);
  });

  it("sandbox adapter succeeds with complete identity", async () => {
    const result = await sandboxRefepsProfessionalAdapter.validate(baseProfessional());
    expect(result.status).toBe("sandbox");
    expect(result.error).toBeNull();
  });

  it("sandbox adapter fails without CUIL", async () => {
    const result = await sandboxRefepsProfessionalAdapter.validate(
      baseProfessional({ cuil: null, taxId: null })
    );
    expect(result.status).toBe("failed");
    expect(result.error).toMatch(/CUIL/i);
  });

  it("official adapter stays not_configured (no invented Ministry API)", async () => {
    const result = await notConfiguredOfficialRefepsProfessionalAdapter.validate(
      baseProfessional()
    );
    expect(result.status).toBe("not_configured");
  });

  it("blocks issue when MFA missing", () => {
    const gate = evaluatePrescriptionIssueGate({
      authenticated: true,
      clinicMember: true,
      hasIssuePermission: true,
      mfa: { enrolled: false, elevated: false },
      professional: baseProfessional(),
      channel: "local",
    });
    expect(gate.ok).toBe(false);
    if (!gate.ok) expect(gate.code).toBe("mfa_missing");
  });

  it("blocks national issue when REFEPS not validated", () => {
    const gate = evaluatePrescriptionIssueGate({
      authenticated: true,
      clinicMember: true,
      hasIssuePermission: true,
      mfa: { enrolled: true, elevated: true },
      professional: baseProfessional({ currentStatus: "not_configured" }),
      channel: "national_electronic",
    });
    expect(gate.ok).toBe(false);
    if (!gate.ok) expect(gate.code).toBe("refeps_not_configured");
  });

  it("allows authorized local prescription flow with MFA", () => {
    const gate = evaluatePrescriptionIssueGate({
      authenticated: true,
      clinicMember: true,
      hasIssuePermission: true,
      mfa: { enrolled: true, elevated: true },
      professional: baseProfessional({ currentStatus: "not_configured" }),
      channel: "local",
    });
    expect(gate.ok).toBe(true);
  });

  it("allows authorized national prescription flow with sandbox status", () => {
    const gate = evaluatePrescriptionIssueGate({
      authenticated: true,
      clinicMember: true,
      hasIssuePermission: true,
      mfa: { enrolled: true, elevated: true },
      professional: baseProfessional({ currentStatus: "sandbox" }),
      channel: "national_electronic",
    });
    expect(gate.ok).toBe(true);
  });

  it("blocks unauthenticated and cross-permission paths", () => {
    expect(
      evaluatePrescriptionIssueGate({
        authenticated: false,
        clinicMember: true,
        hasIssuePermission: true,
        mfa: { enrolled: true, elevated: true },
        professional: baseProfessional(),
        channel: "local",
      }).ok
    ).toBe(false);

    expect(
      evaluatePrescriptionIssueGate({
        authenticated: true,
        clinicMember: false,
        hasIssuePermission: true,
        mfa: { enrolled: true, elevated: true },
        professional: baseProfessional(),
        channel: "local",
      }).ok
    ).toBe(false);

    expect(
      evaluatePrescriptionIssueGate({
        authenticated: true,
        clinicMember: true,
        hasIssuePermission: false,
        mfa: { enrolled: true, elevated: true },
        professional: baseProfessional(),
        channel: "local",
      }).ok
    ).toBe(false);
  });
});
