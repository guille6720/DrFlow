"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";

import { getPrescriptionCoverageRuleOverrides } from "@/features/recetas/actions/coverage-rules";
import { savePrescriptionTemplateFromDraft } from "@/features/recetas/actions/prescription-templates";
import { issuePrescription, savePrescriptionDraft } from "@/features/recetas/actions/prescriptions";
import { emptyPrescriptionMedication } from "@/features/recetas/components/recetas/prescription-form-utils";
import {
  buildPrescriptionContext,
  enrichDraftFromPatient,
  resolveAuthoritativeCoverage,
  validatePrescriptionDraft,
} from "@/features/recetas/engine/prescription-engine";
import { resolveCoverageKind } from "@/features/recetas/engine/resolve-coverage-kind";
import type { ValidationIssue } from "@/features/recetas/engine/types";
import type { PrescriptionTemplateRow } from "@/features/recetas/repositories/prescription-templates.repository";
import {
  type CoverageRuleOverridesMap,
  getEffectiveCoverageRule,
  resolveCoverageRuleOverride,
} from "@/features/recetas/utils/coverage-rules-admin";
import { createPrescriptionIdempotencyKey } from "@/features/recetas/utils/prescription-idempotency";
import { consumePrescriptionReusePrefill } from "@/features/recetas/utils/prescription-reuse-prefill";

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
  notesDefault?: string;
  professionals: Professional[];
  defaultProfessionalId?: string;
  onSuccess?: () => void;
  coverageRuleOverrides?: CoverageRuleOverridesMap | null;
};

function specialtyName(
  specialties: Professional["specialties"]
): string | null {
  if (!specialties) return null;
  if (Array.isArray(specialties)) return specialties[0]?.name ?? null;
  return specialties.name ?? null;
}

function buildWizardBootstrap(
  patientId: string,
  patient: PrescriptionWizardPatient | null | undefined,
  initialMedications: PrescriptionMedication[] | undefined,
  diagnosisDefault: string,
  cie10Default: string,
  notesDefault: string
) {
  const reuse = consumePrescriptionReusePrefill(patientId);
  return {
    patientInsurance:
      reuse?.patient_insurance?.trim() || patient?.insurance_provider?.trim() || "",
    notes: reuse?.notes?.trim() || notesDefault.trim() || "",
    diagnosisText: reuse?.diagnosis_text?.trim() || diagnosisDefault,
    cie10: reuse?.diagnosis_cie10?.trim() || cie10Default,
    medications:
      reuse?.medications?.length
        ? reuse.medications
        : initialMedications && initialMedications.length > 0
          ? initialMedications
          : [emptyPrescriptionMedication()],
    reuseNotice: reuse
      ? reuse.sourcePrescriptionId
        ? "Medicamentos cargados desde una receta anterior. Revisá cobertura y diagnóstico antes de emitir."
        : "Datos precargados. Revisá cobertura y diagnóstico antes de emitir."
      : null,
  };
}

export function usePrescriptionWizard({
  patientId,
  patient,
  clinicalRecordId,
  initialMedications,
  diagnosisDefault = "",
  cie10Default = "",
  notesDefault = "",
  professionals,
  defaultProfessionalId,
  onSuccess,
  coverageRuleOverrides: initialCoverageRuleOverrides = null,
}: Options) {
  const router = useRouter();
  const [, startRefresh] = useTransition();
  const idempotencyRef = useRef<string | null>(null);
  const [coverageRuleOverrides, setCoverageRuleOverrides] = useState<CoverageRuleOverridesMap | null>(
    initialCoverageRuleOverrides
  );
  const [bootstrap] = useState(() =>
    buildWizardBootstrap(
      patientId,
      patient,
      initialMedications,
      diagnosisDefault,
      cie10Default,
      notesDefault
    )
  );

  const [step, setStep] = useState<PrescriptionWizardStep>(1);
  const [professionalId, setProfessionalId] = useState(
    defaultProfessionalId ?? professionals[0]?.id ?? ""
  );
  const [prescriptionType, setPrescriptionType] = useState<PrescriptionType>("ambulatoria");
  const [patientInsurance, setPatientInsurance] = useState(bootstrap.patientInsurance);
  const [insuranceNumber, setInsuranceNumber] = useState(patient?.insurance_number?.trim() ?? "");
  const [insurancePlan, setInsurancePlan] = useState(patient?.insurance_plan?.trim() ?? "");
  const [validityDays, setValidityDays] = useState(30);
  const [notes, setNotes] = useState(bootstrap.notes);
  const [diagnosisText, setDiagnosisText] = useState(bootstrap.diagnosisText);
  const [cie10, setCie10] = useState(bootstrap.cie10);
  const [medications, setMedications] = useState<PrescriptionMedication[]>(bootstrap.medications);
  const [error, setError] = useState<string | null>(null);
  const [fieldIssues, setFieldIssues] = useState<ValidationIssue[]>([]);
  const [loading, setLoading] = useState(false);
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);
  const [confirmIssue, setConfirmIssue] = useState(false);
  const [templateMessage, setTemplateMessage] = useState<string | null>(null);
  const [templateSaving, setTemplateSaving] = useState(false);
  const [saveTemplateName, setSaveTemplateName] = useState("");
  const reuseNotice = bootstrap.reuseNotice;

  useEffect(() => {
    if (initialCoverageRuleOverrides) return;
    let cancelled = false;
    void getPrescriptionCoverageRuleOverrides().then((result) => {
      if (!cancelled && result.data) {
        setCoverageRuleOverrides(result.data);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [initialCoverageRuleOverrides]);

  const coverageKind = useMemo(
    () => resolveCoverageKind(patientInsurance || null),
    [patientInsurance]
  );

  const patientContext = useMemo(
    () => ({
      id: patientId,
      insurance_provider: patient?.insurance_provider ?? null,
      insurance_number: patient?.insurance_number ?? null,
      insurance_plan: patient?.insurance_plan ?? null,
      document_number: patient?.document_number,
    }),
    [
      patientId,
      patient?.insurance_provider,
      patient?.insurance_number,
      patient?.insurance_plan,
      patient?.document_number,
    ]
  );

  const patientInsuranceOnFile = patientContext.insurance_provider?.trim() || null;
  const insuranceLocked = Boolean(patientInsuranceOnFile);
  const effectivePatientInsurance = insuranceLocked
    ? patientInsuranceOnFile ?? ""
    : patientInsurance;

  const authoritativeCoverage = useMemo(
    () =>
      resolveAuthoritativeCoverage(patientContext, {
        patient_insurance: patientInsurance || null,
        coverage_kind: coverageKind,
        insurance_number: insuranceNumber || null,
        insurance_plan: insurancePlan || null,
      }),
    [patientContext, patientInsurance, coverageKind, insuranceNumber, insurancePlan]
  );

  const effectiveCoverageRule = useMemo(
    () =>
      getEffectiveCoverageRule(
        authoritativeCoverage.coverageKind,
        resolveCoverageRuleOverride(authoritativeCoverage.coverageKind, coverageRuleOverrides)
      ),
    [authoritativeCoverage.coverageKind, coverageRuleOverrides]
  );

  const coverageInfoMessages = effectiveCoverageRule.infoMessages ?? [];

  const affiliateLabel = useMemo(
    () => insuranceNumberLabel(effectivePatientInsurance || null),
    [effectivePatientInsurance]
  );

  const planOptions = useMemo(
    () => insurancePlanOptionsForProvider(effectivePatientInsurance, insurancePlan),
    [effectivePatientInsurance, insurancePlan]
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
          insurance_provider: patientContext.insurance_provider,
          insurance_number: patientContext.insurance_number,
          insurance_plan: patientContext.insurance_plan,
          document_number: patientContext.document_number,
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
      patientContext,
    ]
  );

  const validateStep = useCallback(
    (targetStep: PrescriptionWizardStep, mode: "draft" | "issue" = "draft") => {
      if (!professionalId) {
        return [{ severity: "error" as const, code: "professional", message: "Seleccioná el profesional prescriptor.", field: "professional_id" }];
      }

      const draft = buildDraftInput(mode === "issue");
      const ruleOverride = resolveCoverageRuleOverride(
        authoritativeCoverage.coverageKind,
        coverageRuleOverrides
      );
      const ctx = buildPrescriptionContext({
        clinicId: "local",
        patient: patientContext,
        professional: {
          id: professionalId,
          license_national: selectedProfessional?.license_national ?? selectedProfessional?.license_number ?? null,
          license_provincial: selectedProfessional?.license_provincial ?? null,
          specialty_name: specialtyName(selectedProfessional?.specialties ?? null),
        },
        patientInsurance: authoritativeCoverage.patientInsurance,
        coverageKind: authoritativeCoverage.coverageKind,
        clinicRuleOverrides: ruleOverride,
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
      patientContext,
      selectedProfessional,
      authoritativeCoverage,
      coverageRuleOverrides,
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
      startRefresh(() => {
        router.refresh();
      });
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
      startRefresh,
    ]
  );

  const applyTemplate = useCallback((template: PrescriptionTemplateRow) => {
    setError(null);
    setTemplateMessage(null);
    if (template.medications.length > 0) {
      setMedications(template.medications);
    }
    if (template.diagnosis_text?.trim()) setDiagnosisText(template.diagnosis_text);
    if (template.diagnosis_cie10?.trim()) setCie10(template.diagnosis_cie10);
    if (template.notes?.trim()) setNotes(template.notes);
    setTemplateMessage(`Plantilla "${template.name}" aplicada. Revisá antes de emitir.`);
    setStep(2);
  }, []);

  const saveAsTemplate = useCallback(async () => {
    const name = saveTemplateName.trim();
    if (name.length < 2) {
      setError("Ingresá un nombre de al menos 2 caracteres para la plantilla.");
      return;
    }

    const filledMeds = medications.filter((m) => m.generic_name.trim());
    if (filledMeds.length === 0) {
      setError("Agregá al menos un medicamento antes de guardar la plantilla.");
      return;
    }

    setTemplateSaving(true);
    setError(null);
    setTemplateMessage(null);

    const result = await savePrescriptionTemplateFromDraft({
      name,
      professional_id: professionalId || null,
      coverage_kind: coverageKind,
      medications: filledMeds,
      notes: notes || null,
      diagnosis_cie10: cie10 || null,
      diagnosis_text: diagnosisText || null,
    });

    setTemplateSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }

    setTemplateMessage(`Plantilla "${name}" guardada.`);
    setSaveTemplateName("");
  }, [
    saveTemplateName,
    medications,
    professionalId,
    coverageKind,
    notes,
    cie10,
    diagnosisText,
  ]);

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
    validateStep,
    coverageKind,
    affiliateLabel,
    planOptions,
    selectedProfessional,
    buildDraftInput,
    applyTemplate,
    saveAsTemplate,
    templateMessage,
    templateSaving,
    saveTemplateName,
    setSaveTemplateName,
    reuseNotice,
    coverageInfoMessages,
    effectiveMaxValidityDays: effectiveCoverageRule.maxValidityDays ?? 30,
    effectiveMedicationSearch: effectiveCoverageRule.medicationSearch,
    insuranceLocked,
    authoritativeCoverageKind: authoritativeCoverage.coverageKind,
    effectivePatientInsurance,
  };
}
