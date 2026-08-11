import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";

import { mapInformedConsentRow } from "@/core/compliance/informed-consent-types";
import { CONSENT_TYPES } from "@/core/legal/documents";
import {
  buildInformedConsentProcedureDefault,
  INFORMED_CONSENT_DOCUMENT_VERSION,
  informedConsentPatientDisplayName,
} from "@/core/legal/informed-consent";

describe("098_informed_consent migration", () => {
  const sql = readFileSync(
    resolve(process.cwd(), "supabase/migrations/098_informed_consent.sql"),
    "utf8"
  );

  it("extends consent_records for clinical act linkage", () => {
    expect(sql).toMatch(/clinical_record_id UUID REFERENCES clinical_records/);
    expect(sql).toMatch(/procedure_description TEXT/);
    expect(sql).toMatch(/signature_name TEXT/);
  });

  it("defines record_informed_consent RPC with clinic checks", () => {
    expect(sql).toMatch(/record_informed_consent/);
    expect(sql).toMatch(/can_view_clinical\(p_clinic_id\)/);
    expect(sql).toMatch(/informed_consent_clinical_act/);
  });

  it("prevents duplicate granted consent per clinical record", () => {
    expect(sql).toMatch(/idx_consent_records_informed_per_record/);
    expect(sql).toMatch(/INFORMED_CONSENT_ALREADY_RECORDED/);
  });
});

describe("informed-consent helpers", () => {
  it("uses a dedicated consent type constant", () => {
    expect(CONSENT_TYPES.informedConsentClinicalAct).toBe("informed_consent_clinical_act");
  });

  it("buildInformedConsentProcedureDefault prefers chief complaint", () => {
    expect(buildInformedConsentProcedureDefault("Dolor abdominal")).toBe(
      "Consulta / acto médico: Dolor abdominal"
    );
    expect(buildInformedConsentProcedureDefault(null)).toMatch(/Consulta médica/);
  });

  it("informedConsentPatientDisplayName joins names", () => {
    expect(informedConsentPatientDisplayName("Ana", "García")).toBe("Ana García");
  });

  it("mapInformedConsentRow maps DB row", () => {
    const mapped = mapInformedConsentRow({
      id: "c1",
      clinical_record_id: "cr1",
      patient_id: "p1",
      appointment_id: null,
      granted: true,
      granted_at: "2026-08-11T12:00:00.000Z",
      document_version: INFORMED_CONSENT_DOCUMENT_VERSION,
      procedure_description: "Consulta",
      signature_name: "Ana García",
      notes: null,
      created_at: "2026-08-11T12:00:00.000Z",
      profiles: { full_name: "Dr. Castro" },
    });

    expect(mapped?.clinicalRecordId).toBe("cr1");
    expect(mapped?.recordedByName).toBe("Dr. Castro");
    expect(mapped?.signatureName).toBe("Ana García");
  });
});
