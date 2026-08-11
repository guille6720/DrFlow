import { describe, expect, it } from "vitest";

import { prescriptionDraftSchema, prescriptionMedicationSchema } from "@/core/validations/schemas";

import {
  buildPrescriptionContext,
  enrichDraftFromPatient,
  resolveAuthoritativeCoverageForIssue,
  validatePrescriptionDraft,
} from "@/features/recetas/engine/prescription-engine";
import { buildPrescriptionDocumentData } from "@/features/recetas/utils/build-prescription-document-data";

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

const professional = {
  id: baseDraft.professional_id,
  license_national: "MN 12345",
  license_provincial: null,
};

describe("prescription engine QA matrix", () => {
  describe("functional — coverage strategies", () => {
    it("particular issues without affiliate number", () => {
      const patient = {
        id: baseDraft.patient_id,
        insurance_provider: "Particular",
        insurance_number: null,
        insurance_plan: null,
      };
      const ctx = buildPrescriptionContext({
        clinicId: "clinic-1",
        patient,
        professional,
        patientInsurance: "Particular",
      });
      const result = validatePrescriptionDraft(
        ctx,
        { ...baseDraft, patient_insurance: "Particular", coverage_kind: "PARTICULAR" },
        "issue"
      );
      expect(result.valid).toBe(true);
    });

    it("PAMI requires beneficio on issue", () => {
      const patient = {
        id: baseDraft.patient_id,
        insurance_provider: "PAMI",
        insurance_number: null,
        insurance_plan: null,
      };
      const ctx = buildPrescriptionContext({
        clinicId: "clinic-1",
        patient,
        professional,
        patientInsurance: "PAMI",
      });
      const result = validatePrescriptionDraft(
        ctx,
        {
          ...baseDraft,
          patient_insurance: "PAMI",
          coverage_kind: "PAMI",
          insurance_number: null,
        },
        "issue"
      );
      expect(result.valid).toBe(false);
      expect(result.issues.some((i) => i.field === "insurance_number")).toBe(true);
    });

    it("obra social requires affiliate number", () => {
      const patient = {
        id: baseDraft.patient_id,
        insurance_provider: "IOMA",
        insurance_number: null,
        insurance_plan: null,
      };
      const ctx = buildPrescriptionContext({
        clinicId: "clinic-1",
        patient,
        professional,
        patientInsurance: "IOMA",
      });
      const result = validatePrescriptionDraft(
        ctx,
        {
          ...baseDraft,
          patient_insurance: "IOMA",
          coverage_kind: "OBRAS_SOCIALES",
          insurance_number: null,
        },
        "issue"
      );
      expect(result.valid).toBe(false);
    });

    it("prepaga requires affiliate and plan", () => {
      const patient = {
        id: baseDraft.patient_id,
        insurance_provider: "OSDE 310",
        insurance_number: "123",
        insurance_plan: null,
      };
      const ctx = buildPrescriptionContext({
        clinicId: "clinic-1",
        patient,
        professional,
        patientInsurance: "OSDE 310",
      });
      const result = validatePrescriptionDraft(
        ctx,
        {
          ...baseDraft,
          patient_insurance: "OSDE 310",
          coverage_kind: "PREPAGAS",
          insurance_number: "123",
          insurance_plan: null,
        },
        "issue"
      );
      expect(result.valid).toBe(false);
      expect(result.issues.some((i) => i.field === "insurance_plan")).toBe(true);
    });

    it("includes all medication lines in document data", () => {
      const meds = [
        { generic_name: "Losartán", quantity: 1, posology: "1/día" },
        { generic_name: "Amlodipina", quantity: 1, posology: "1/día" },
      ];
      const data = buildPrescriptionDocumentData(
        {
          id: "rx-1",
          created_at: "2026-08-11T12:00:00.000Z",
          issued_at: "2026-08-11T12:05:00.000Z",
          status: "issued",
          prescription_number: "RX-1",
          prescription_type: "ambulatoria",
          validity_days: 30,
          diagnosis_cie10: "I10",
          diagnosis_text: "HTA",
          medications: meds,
          professional_id: professional.id,
        },
        {
          first_name: "Ana",
          last_name: "López",
          document_number: "30111222",
        },
        { name: "Clínica" },
        [{ id: professional.id, display_name: "Dr. Test" }]
      );
      expect(data.medications).toHaveLength(2);
    });
  });

  describe("security — authoritative coverage on issue", () => {
    it("ignores tampered PARTICULAR when patient record is PAMI", () => {
      const patient = {
        id: baseDraft.patient_id,
        insurance_provider: "PAMI",
        insurance_number: null,
        insurance_plan: null,
      };
      const authoritative = resolveAuthoritativeCoverageForIssue(patient, {
        patient_insurance: "Particular",
        coverage_kind: "PARTICULAR",
        insurance_number: null,
        insurance_plan: null,
      });
      expect(authoritative.coverageKind).toBe("PAMI");

      const ctx = buildPrescriptionContext({
        clinicId: "clinic-1",
        patient,
        professional,
        patientInsurance: authoritative.patientInsurance,
        coverageKind: authoritative.coverageKind,
      });
      const tamperedDraft = {
        ...baseDraft,
        patient_insurance: "Particular",
        coverage_kind: "PARTICULAR" as const,
        insurance_number: null,
      };
      const result = validatePrescriptionDraft(ctx, tamperedDraft, "issue");
      expect(result.valid).toBe(false);
    });

    it("normalizes tampered PARTICULAR to PAMI on draft save when patient record is PAMI", () => {
      const patient = {
        id: baseDraft.patient_id,
        insurance_provider: "PAMI",
        insurance_number: null,
        insurance_plan: null,
      };
      const authoritative = resolveAuthoritativeCoverageForIssue(patient, {
        patient_insurance: "Particular",
        coverage_kind: "PARTICULAR",
        insurance_number: null,
        insurance_plan: null,
      });
      const ctx = buildPrescriptionContext({
        clinicId: "clinic-1",
        patient,
        professional,
        patientInsurance: authoritative.patientInsurance,
        coverageKind: authoritative.coverageKind,
      });
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

      const draftResult = validatePrescriptionDraft(ctx, enriched, "draft");
      expect(draftResult.valid).toBe(false);
      expect(draftResult.issues.some((i) => i.field === "insurance_number")).toBe(true);

      const issueResult = validatePrescriptionDraft(ctx, enriched, "issue");
      expect(issueResult.valid).toBe(false);
    });
  });

  describe("edge — validation boundaries", () => {
    it("rejects quantity below 1 via Zod", () => {
      const parsed = prescriptionMedicationSchema.safeParse({
        generic_name: "Losartán",
        quantity: 0,
        posology: "1/día",
      });
      expect(parsed.success).toBe(false);
    });

    it("rejects issue without disclaimer", () => {
      const patient = {
        id: baseDraft.patient_id,
        insurance_provider: "Particular",
        insurance_number: null,
        insurance_plan: null,
      };
      const ctx = buildPrescriptionContext({
        clinicId: "clinic-1",
        patient,
        professional,
        patientInsurance: "Particular",
      });
      const result = validatePrescriptionDraft(
        ctx,
        {
          ...baseDraft,
          disclaimer_accepted: false,
          patient_insurance: "Particular",
          coverage_kind: "PARTICULAR",
        },
        "issue"
      );
      expect(result.valid).toBe(false);
      expect(result.issues.some((i) => i.code === "disclaimer_required")).toBe(true);
    });

    it("accepts manual medication names within schema limits", () => {
      const parsed = prescriptionDraftSchema.safeParse({
        ...baseDraft,
        medications: [{ generic_name: "Medicamento manual", quantity: 1, posology: "Según indicación" }],
      });
      expect(parsed.success).toBe(true);
    });
  });

  describe("wizard — clinic rule overrides", () => {
    it("applies clinic override for required fields in validation context", () => {
      const patient = {
        id: baseDraft.patient_id,
        insurance_provider: "Particular",
        insurance_number: null,
        insurance_plan: null,
      };
      const ctx = buildPrescriptionContext({
        clinicId: "clinic-1",
        patient,
        professional,
        patientInsurance: "Particular",
        coverageKind: "PARTICULAR",
        clinicRuleOverrides: { requiredFields: ["diagnosis_cie10"] },
      });
      const result = validatePrescriptionDraft(
        ctx,
        {
          ...baseDraft,
          diagnosis_cie10: "",
          patient_insurance: "Particular",
          coverage_kind: "PARTICULAR",
        },
        "issue"
      );
      expect(result.valid).toBe(false);
      expect(result.issues.some((i) => i.field === "diagnosis_cie10")).toBe(true);
    });
  });
});
