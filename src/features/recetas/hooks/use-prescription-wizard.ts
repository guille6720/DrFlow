"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";

import { issuePrescription, savePrescriptionDraft } from "@/features/recetas/actions/prescriptions";
import { emptyPrescriptionMedication } from "@/features/recetas/components/recetas/prescription-form-utils";
import {
  buildPrescriptionContext,
  enrichDraftFromPatient,
  validatePrescriptionDraft,
} from "@/features/recetas/engine/prescription-engine";
import { resolveCoverageKind } from "@/features/recetas/engine/resolve-coverage-kind";
import type { ValidationIssue } from "@/features/recetas/engine/types";
import { createPrescriptionIdempotencyKey } from "@/features/recetas/utils/prescription-idempotency";

import {
  insuranceNumberLabel,
  insurancePlanOptionsForProvider,
} from "@/lib/constants/coverages";
import type { PrescriptionMedication, PrescriptionType } from "@/types/prescription";

export type PrescriptionWizardStep = 1 | 2 | 3;

export type PrescriptionWizardPatient = {
  id: string;
  first_name: string;
  last_name: string;
  document_number: string;
  insurance_provider?: string | null;
  insurance_number?: string | null;
  insurance_plan?: string | null;
};

type Professional = {
  id: string;
  license_number?: string | null;
  license_national?: string | null;
  license_provincial?: string | null;
  display_name?: string | null;
  profiles?: { full_name: string } | null;
  specialties?: { name: string } | { name: string }[] | null;
};

type Options = {
  patientId: string;
  patient?: PrescriptionWizardPatient | null;
  clinicalRecordId?: string;
  initialMedications?: PrescriptionMedication[];
  diagnosisDefault?: string;
  cie10Default?: string;
  professionals: Professional[];
  defaultProfessionalId?: string;
  onSuccess?: () => void;
};

function specialtyName(
  specialties: Professional["specialties"]
): string | null {
  if (!specialties) return null;
  if (Array.isArray(specialties)) return specialties[0]?.name ?? null;
  return specialties.name ?? null;
}

export function usePrescriptionWizard({
  patientId,
  patient,
  clinicalRecordId,
  initialMedications,
  diagnosisDefault = "",
  cie10Default = "",
  professionals,
  defaultProfessionalId,
  onSuccess,
}: Options) {
  const router = useRouter();
  const idempotencyRef = useRef<string | null>(null);

  const [step, setStep] = useState<PrescriptionWizardStep>(1);
  const [professionalId, setProfessionalId] = useState(
    defaultProfessionalId ?? professionals[0]?.id ?? ""
  );
  const [prescriptionType, setPrescriptionType] = useState<PrescriptionType>("ambulatoria");
  const [patientInsurance, setPatientInsurance] = useState(
    patient?.insurance_provider?.trim() ?? ""
  );
  const [insuranceNumber, setInsuranceNumber] = useState(patient?.insurance_number?.trim() ?? "");
  const [insurancePlan, setInsurancePlan] = useState(patient?.insurance_plan?.trim() ?? "");
  const [validityDays, setValidityDays] = useState(30);
  const [notes, setNotes] = useState("");
  const [diagnosisText, setDiagnosisText] = useState(diagnosisDefault);
  const [cie10, setCie10] = useState(cie10Default);
  const [medications, setMedications] = useState<PrescriptionMedication[]>(
    initialMedications && initialMedications.length > 0
      ? initialMedications
      : [emptyPrescriptionMedication()]
  );
  const [error, setError] = useState<string | null>(null);
  const [fieldIssues, setFieldIssues] = useState<ValidationIssue[]>([]);
  const [loading, setLoading] = useState(false);
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);
  const [confirmIssue, setConfirmIssue] = useState(false);

  const coverageKind = useMemo(
    () => resolveCoverageKind(patientInsurance || null),
    [patientInsurance]
  );

  const affiliateLabel = useMemo(
    () => insuranceNumberLabel(patientInsurance || null),
    [patientInsurance]
  );

  const planOptions = useMemo(
    () => insurancePlanOptionsForProvider(patientInsurance, insurancePlan),
    [patientInsurance, insurancePlan]
  );

  const selectedProfessional = useMemo(
    () => professionals.find((p) => p.id === professionalId) ?? null,
    [professionals, professionalId]
  );

  function updateMed(
    index: number,
    field: keyof PrescriptionMedication,
    value: string | number | boolean
  ) {
    setMedications((prev) => prev.map((m, i) => (i === index ? { ...m, [field]: value } : m)));
  }

  const buildDraftInput = useCallback(
    (disclaimer: boolean) =>
      enrichDraftFromPatient(
        {
          patient_id: patientId,
          clinical_record_id: clinicalRecordId ?? null,
          professional_id: professionalId,
          prescription_type: prescriptionType,
          diagnosis_cie10: cie10,
          diagnosis_text: diagnosisText,
          patient_insurance: patientInsurance || null,
          coverage_kind: coverageKind,
          insurance_number: insuranceNumber || null,
          insurance_plan: insurancePlan || null,
          medications,
          notes: notes || null,
          validity_days: validityDays,
          disclaimer_accepted: disclaimer,
        },
        {
          id: patientId,
          insurance_provider: patient?.insurance_provider ?? patientInsurance,
          insurance_number: patient?.insurance_number ?? insuranceNumber,
          insurance_plan: patient?.insurance_plan ?? insurancePlan,
          document_number: patient?.document_number,
        }
      ),
    [
      patientId,
      clinicalRecordId,
      professionalId,
      prescriptionType,
      cie10,
      diagnosisText,
      patientInsurance,
      coverageKind,
      insuranceNumber,
      insurancePlan,
      medications,
      notes,
      validityDays,
      patient?.insurance_provider,
      patient?.insurance_number,
      patient?.insurance_plan,
      patient?.document_number,
    ]
  );

  const validateStep = useCallback(
    (targetStep: PrescriptionWizardStep, mode: "draft" | "issue" = "draft") => {
      if (!professionalId) {
        return [{ severity: "error" as const, code: "professional", message: "Seleccioná el profesional prescriptor.", field: "professional_id" }];
      }

      const draft = buildDraftInput(mode === "issue");
      const ctx = buildPrescriptionContext({
        clinicId: "local",
        patient: {
          id: patientId,
          insurance_provider: patientInsurance,
          insurance_number: insuranceNumber,
          insurance_plan: insurancePlan,
          document_number: patient?.document_number,
        },
        professional: {
          id: professionalId,
          license_national: selectedProfessional?.license_national ?? selectedProfessional?.license_number ?? null,
          license_provincial: selectedProfessional?.license_provincial ?? null,
          specialty_name: specialtyName(selectedProfessional?.specialties ?? null),
        },
        patientInsurance,
        coverageKind,
      });

      const result = validatePrescriptionDraft(ctx, draft, mode);

      if (targetStep === 1) {
        return result.issues.filter(
          (issue) =>
            issue.field?.startsWith("diagnosis") ||
            issue.field === "professional_id" ||
            issue.field === "insurance_number" ||
            issue.field === "insurance_plan" ||
            issue.field === "patient_insurance" ||
            issue.field === "validity_days"
        );
      }

      if (targetStep === 2) {
        return result.issues.filter(
          (issue) => issue.field?.startsWith("medications") || issue.code.startsWith("medication")
        );
      }

      return result.issues.filter((issue) => issue.severity === "error");
    },
    [
      professionalId,
      buildDraftInput,
      patientId,
      patientInsurance,
      insuranceNumber,
      insurancePlan,
      patient?.document_number,
      selectedProfessional,
      coverageKind,
    ]
  );

  function applyIssues(issues: ValidationIssue[]) {
    setFieldIssues(issues);
    const first = issues.find((i) => i.severity === "error");
    setError(first?.message ?? null);
    return issues.every((i) => i.severity !== "error");
  }

  function goNext() {
    setError(null);
    setFieldIssues([]);
    const issues = validateStep(step, "draft");
    if (!applyIssues(issues)) return;
    setStep((prev) => Math.min(3, prev + 1) as PrescriptionWizardStep);
  }

  function goBack() {
    setError(null);
    setFieldIssues([]);
    setStep((prev) => Math.max(1, prev - 1) as PrescriptionWizardStep);
  }

  const handleSubmit = useCallback(
    async (issue: boolean) => {
      setError(null);
      setFieldIssues([]);

      if (issue && !confirmIssue) {
        setError("Confirmá la emisión antes de continuar.");
        return;
      }

      if (!disclaimerAccepted) {
        setError("Debés aceptar el aviso legal antes de continuar.");
        return;
      }

      const issues = validateStep(3, issue ? "issue" : "draft");
      if (!applyIssues(issues)) return;

      setLoading(true);

      const formData = new FormData();
      formData.set("patient_id", patientId);
      if (clinicalRecordId) formData.set("clinical_record_id", clinicalRecordId);
      formData.set("professional_id", professionalId);
      formData.set("prescription_type", prescriptionType);
      formData.set("diagnosis_cie10", cie10);
      formData.set("diagnosis_text", diagnosisText);
      formData.set("patient_insurance", patientInsurance);
      formData.set("insurance_number", insuranceNumber);
      formData.set("insurance_plan", insurancePlan);
      formData.set("coverage_kind", coverageKind);
      formData.set("validity_days", String(validityDays));
      formData.set("notes", notes);
      formData.set("medications_json", JSON.stringify(medications));
      formData.set("disclaimer_accepted", "true");

      const saved = await savePrescriptionDraft(formData);
      if (saved.error) {
        setLoading(false);
        setError(saved.error);
        return;
      }

      if (issue && saved.data) {
        if (!idempotencyRef.current) {
          idempotencyRef.current = createPrescriptionIdempotencyKey();
        }
        const issued = await issuePrescription(saved.data.id, idempotencyRef.current);
        setLoading(false);
        if (issued.error) {
          setError(issued.error);
          return;
        }
      } else {
        setLoading(false);
      }

      onSuccess?.();
      router.refresh();
    },
    [
      confirmIssue,
      disclaimerAccepted,
      validateStep,
      patientId,
      clinicalRecordId,
      professionalId,
      prescriptionType,
      cie10,
      diagnosisText,
      patientInsurance,
      insuranceNumber,
      insurancePlan,
      coverageKind,
      validityDays,
      notes,
      medications,
      onSuccess,
      router,
    ]
  );

  return {
    step,
    setStep,
    goNext,
    goBack,
    professionalId,
    setProfessionalId,
    prescriptionType,
    setPrescriptionType,
    patientInsurance,
    setPatientInsurance,
    insuranceNumber,
    setInsuranceNumber,
    insurancePlan,
    setInsurancePlan,
    validityDays,
    setValidityDays,
    notes,
    setNotes,
    diagnosisText,
    setDiagnosisText,
    cie10,
    setCie10,
    medications,
    setMedications,
    updateMed,
    error,
    fieldIssues,
    loading,
    disclaimerAccepted,
    setDisclaimerAccepted,
    confirmIssue,
    setConfirmIssue,
    handleSubmit,
    coverageKind,
    affiliateLabel,
    planOptions,
    selectedProfessional,
    buildDraftInput,
  };
}
