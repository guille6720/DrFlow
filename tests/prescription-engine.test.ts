import { describe, expect, it } from "vitest";

import { findDuplicateMedications } from "@/features/recetas/engine/medication-duplicates";
import {
  buildPrescriptionContext,
  enrichDraftFromPatient,
  validatePrescriptionDraft,
} from "@/features/recetas/engine/prescription-engine";
import { resolveCoverageKind } from "@/features/recetas/engine/resolve-coverage-kind";

const baseDraft = {
  patient_id: "550e8400-e29b-41d4-a716-446655440000",
  professional_id: "550e8400-e29b-41d4-a716-446655440001",
  prescription_type: "ambulatoria" as const,
  diagnosis_cie10: "I10",
  diagnosis_text: "Hipertensión esencial",
  medications: [
    {
      generic_name: "Losartán",
      quantity: 1,
      posology: "1 comprimido cada 24 hs",
    },
  ],
  validity_days: 30,
  disclaimer_accepted: true as const,
};

describe("resolveCoverageKind", () => {
  it("detects PAMI", () => {
    expect(resolveCoverageKind("PAMI")).toBe("PAMI");
    expect(resolveCoverageKind("pami plan")).toBe("PAMI");
  });

  it("detects prepagas", () => {
    expect(resolveCoverageKind("OSDE 310")).toBe("PREPAGAS");
  });

  it("detects particular", () => {
    expect(resolveCoverageKind("Particular")).toBe("PARTICULAR");
    expect(resolveCoverageKind("")).toBe("PARTICULAR");
  });

  it("defaults unknown OS to OBRAS_SOCIALES", () => {
    expect(resolveCoverageKind("IOMA")).toBe("OBRAS_SOCIALES");
  });
});

describe("findDuplicateMedications", () => {
  it("flags duplicate generic/concentration/presentation", () => {
    const issues = findDuplicateMedications([
      { generic_name: "Losartán", quantity: 1, posology: "1/día" },
      { generic_name: "losartán", quantity: 2, posology: "2/día" },
    ]);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.code).toBe("duplicate_medication");
  });
});

describe("validatePrescriptionDraft", () => {
  const patient = {
    id: baseDraft.patient_id,
    insurance_provider: "PAMI",
    insurance_number: "123456789",
    insurance_plan: "PMO",
  };

  const professional = {
    id: baseDraft.professional_id,
    license_national: "MN 12345",
    license_provincial: null,
  };

  it("enriches draft from patient coverage data", () => {
    const enriched = enrichDraftFromPatient(
      { ...baseDraft, patient_insurance: undefined },
      patient
    );
    expect(enriched.coverage_kind).toBe("PAMI");
    expect(enriched.insurance_number).toBe("123456789");
  });

  it("ignores tampered coverage_kind when patient record has insurance on file", () => {
    const enriched = enrichDraftFromPatient(
      {
        ...baseDraft,
        patient_insurance: "Particular",
        coverage_kind: "PARTICULAR",
        insurance_number: null,
      },
      patient
    );
    expect(enriched.coverage_kind).toBe("PAMI");
    expect(enriched.patient_insurance).toBe("PAMI");
  });

  it("allows form coverage when patient has no insurance on file", () => {
    const enriched = enrichDraftFromPatient(
      {
        ...baseDraft,
        patient_insurance: "IOMA",
        coverage_kind: "OBRAS_SOCIALES",
      },
      { ...patient, insurance_provider: null, insurance_number: null, insurance_plan: null }
    );
    expect(enriched.coverage_kind).toBe("OBRAS_SOCIALES");
    expect(enriched.patient_insurance).toBe("IOMA");
  });

  it("requires PAMI beneficio on draft save", () => {
    const ctx = buildPrescriptionContext({
      clinicId: "clinic-1",
      patient: { ...patient, insurance_number: null },
      professional,
      patientInsurance: "PAMI",
    });

    const result = validatePrescriptionDraft(
      ctx,
      enrichDraftFromPatient(
        { ...baseDraft, insurance_number: null, patient_insurance: "PAMI" },
        { ...patient, insurance_number: null }
      ),
      "draft"
    );

    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.field === "insurance_number")).toBe(true);
  });

  it("requires PAMI beneficio on issue", () => {
    const ctx = buildPrescriptionContext({
      clinicId: "clinic-1",
      patient: { ...patient, insurance_number: null },
      professional,
      patientInsurance: "PAMI",
    });

    const result = validatePrescriptionDraft(
      ctx,
      enrichDraftFromPatient(
        { ...baseDraft, insurance_number: null, patient_insurance: "PAMI" },
        { ...patient, insurance_number: null }
      ),
      "issue"
    );

    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.field === "insurance_number")).toBe(true);
  });

  it("passes valid PAMI issue", () => {
    const ctx = buildPrescriptionContext({
      clinicId: "clinic-1",
      patient,
      professional,
      patientInsurance: "PAMI",
    });

    const draft = enrichDraftFromPatient(
      { ...baseDraft, patient_insurance: "PAMI" },
      patient
    );

    const result = validatePrescriptionDraft(ctx, draft, "issue");
    expect(result.valid).toBe(true);
  });

  it("rejects issue without professional license", () => {
    const ctx = buildPrescriptionContext({
      clinicId: "clinic-1",
      patient,
      professional: { id: professional.id, license_national: null, license_provincial: null },
      patientInsurance: "Particular",
    });

    const result = validatePrescriptionDraft(
      ctx,
      enrichDraftFromPatient({ ...baseDraft, patient_insurance: "Particular" }, patient),
      "issue"
    );

    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === "license_required")).toBe(true);
  });
});
