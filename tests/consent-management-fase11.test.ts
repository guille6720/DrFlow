import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";

import {
  CONSENT_DOCUMENT_CATALOG,
  CONSENT_EVIDENCE_FIELDS,
  evaluateConsentManagementPosture,
  getConsentDocumentDefinition,
  resolveConsentLifecycleStatus,
} from "@/core/compliance/consent-management";
import { CONSENT_TYPES } from "@/core/legal/documents";

const ROOT = process.cwd();

describe("consent-management policy module", () => {
  it("catalog covers booking, clinical, signup and privacy", () => {
    const types = CONSENT_DOCUMENT_CATALOG.map((d) => d.consentType);
    expect(types).toContain(CONSENT_TYPES.patientDataProcessingBooking);
    expect(types).toContain(CONSENT_TYPES.informedConsentClinicalAct);
    expect(types).toContain(CONSENT_TYPES.clinicTermsSignup);
    expect(types).toContain(CONSENT_TYPES.clinicPrivacySignup);
  });

  it("lists Phase 11 evidence fields including withdrawal", () => {
    expect(CONSENT_EVIDENCE_FIELDS).toContain("purpose");
    expect(CONSENT_EVIDENCE_FIELDS).toContain("source");
    expect(CONSENT_EVIDENCE_FIELDS).toContain("withdrawn_at");
  });

  it("resolveConsentLifecycleStatus handles grant and withdrawal", () => {
    expect(resolveConsentLifecycleStatus({ granted: true })).toBe("granted");
    expect(
      resolveConsentLifecycleStatus({
        granted: true,
        withdrawn_at: "2026-08-23T12:00:00Z",
      })
    ).toBe("withdrawn");
    expect(resolveConsentLifecycleStatus({ granted: false })).toBe("denied");
  });

  it("evaluateConsentManagementPosture reports hardened flags", () => {
    const status = evaluateConsentManagementPosture();
    expect(status.appendOnlyHistory).toBe(true);
    expect(status.withdrawalSupported).toBe(true);
    expect(status.clinicSignupPersisted).toBe(true);
    expect(status.documentCount).toBeGreaterThanOrEqual(4);
  });

  it("getConsentDocumentDefinition resolves versioned docs", () => {
    const booking = getConsentDocumentDefinition(
      CONSENT_TYPES.patientDataProcessingBooking
    );
    expect(booking?.documentVersion).toBeTruthy();
    expect(booking?.requiresPatient).toBe(true);
  });
});

describe("134_consent_management migration", () => {
  const sql = readFileSync(
    resolve(ROOT, "supabase/migrations/134_consent_management.sql"),
    "utf8"
  );

  it("adds purpose, source and withdrawal columns", () => {
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS purpose TEXT/);
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS source TEXT/);
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS withdrawn_at TIMESTAMPTZ/);
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS withdrawn_by/);
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS withdrawal_reason/);
  });

  it("allows clinic-level consent without patient_id", () => {
    expect(sql).toMatch(/ALTER COLUMN patient_id DROP NOT NULL/);
  });

  it("enforces immutability except one-time withdrawal", () => {
    expect(sql).toMatch(/enforce_consent_record_immutability/);
    expect(sql).toMatch(/CONSENT_IMMUTABLE/);
    expect(sql).toMatch(/REVOKE UPDATE, DELETE ON consent_records FROM authenticated/);
  });

  it("defines withdraw and clinic legal consent RPCs", () => {
    expect(sql).toMatch(/withdraw_patient_consent/);
    expect(sql).toMatch(/record_clinic_legal_consent/);
  });

  it("unique informed consent ignores withdrawn rows", () => {
    expect(sql).toMatch(/withdrawn_at IS NULL/);
    expect(sql).toMatch(/informed_consent_clinical_act/);
  });
});

describe("Phase 11 app wiring", () => {
  it("signup persists consent_records via record_clinic_legal_consent", () => {
    const src = readFileSync(
      resolve(ROOT, "src/core/legal/apply-clinic-legal-acceptance.ts"),
      "utf8"
    );
    expect(src).toContain("record_clinic_legal_consent");
    expect(src).toContain("clinicTermsSignup");
    expect(src).toContain("clinicPrivacySignup");
  });

  it("informed consent action supports withdrawal and filters withdrawn", () => {
    const src = readFileSync(
      resolve(ROOT, "src/lib/actions/informed-consent.ts"),
      "utf8"
    );
    expect(src).toContain("withdrawPatientConsent");
    expect(src).toContain('is("withdrawn_at", null)');
    expect(src).toContain("withdraw_patient_consent");
  });
});
