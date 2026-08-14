"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { ConsultPatientPickerRow } from "@/core/supabase/query-types";

import { backHrefFromClinicalSubpage } from "@/shared/utils/clinical-navigation";

import { createClinicalRecord } from "@/features/historias/actions/clinical-records";
import {
  buildDiagnosisText,
  type ClinicalDiagnosisEntry,
  type ClinicalTreatmentEntry,
  mergeTreatmentsForPersist,
} from "@/features/historias/utils/clinical-structured-entries";
import type { PatientSearchOption } from "@/features/pacientes/components/pacientes/patient-search-combobox";
import { buildPatientWorkspaceUrl } from "@/features/pacientes/utils/patient-workspace-actions";
import { buildConsultIndicationsText } from "@/features/recetas/utils/build-consult-indications-text";
import { saveInlineConsultPrescriptionSnapshot } from "@/features/recetas/utils/inline-consult-prescription-bridge";

import { startConsultationFromAppointment } from "@/lib/actions/appointments";
import type { ClinicalTemplateFieldSet } from "@/lib/utils/clinical-template-variables";
import {
  extractTemplateVariableKeys,
  resolveClinicalTemplateFields,
} from "@/lib/utils/clinical-template-variables";
import {
  buildPharmacologyHrefFromConsultation,
  buildRecetasHrefFromConsultation,
  clearConsultationEvolution,
  consultationDraftKey,
  readConsultationEvolution,
  saveConsultationEvolution,
} from "@/lib/utils/consultation-draft";
import { buildProfessionalSignature } from "@/lib/utils/professional";
import type { PrescriptionMedication } from "@/types/prescription";

type Template = {
  id: string;
  name: string;
  chief_complaint_template: string | null;
  diagnosis_template: string | null;
  evolution_template: string | null;
  indications_template: string | null;
};

export type NuevaConsultaWorkspaceConfig = {
  patientId: string;
  appointmentId?: string;
  professionalId?: string;
  onSaved: (recordId: string, silent?: boolean) => void;
  onClose: () => void;
};

type ConsultFormProfessional = {
  id: string;
  display_name?: string | null;
  license_number?: string | null;
  license_national?: string | null;
  license_provincial?: string | null;
  signature_text?: string | null;
  signature_image_url?: string | null;
  profiles?: { full_name?: string } | { full_name?: string }[] | null;
};

type Options = {
  patients: ConsultPatientPickerRow[];
  professionals: ConsultFormProfessional[];
  templates: Template[];
  workspace?: NuevaConsultaWorkspaceConfig;
  fallbackProfessionalId?: string;
};

function toDatetimeLocalValue(date: Date): string {
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}

function templateText(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

function buildEvolutionWithVitals(evolution: string, vitals: string): string {
  const base = evolution.trim();
  const vitalsText = vitals.trim();
  if (!vitalsText) return base;
  const vitalsBlock = `Signos vitales: ${vitalsText}`;
  return base ? `${base}\n\n${vitalsBlock}` : vitalsBlock;
}

type ConsultFormDraft = {
  evolution: string;
  chiefComplaint: string;
  diagnosis: string;
  diagnoses: ClinicalDiagnosisEntry[];
  indications: string;
  clinicalTreatments: ClinicalTreatmentEntry[];
  treatmentMedications: PrescriptionMedication[];
  vitals: string;
  isDirty: boolean;
};

export function useNuevaConsultaForm({
  patients,
  professionals,
  templates,
  workspace,
  fallbackProfessionalId,
}: Options) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const defaultPatient = workspace?.patientId ?? searchParams.get("patient") ?? "";
  const defaultProfessional =
    workspace?.professionalId ??
    searchParams.get("professional") ??
    fallbackProfessionalId ??
    "";
  const appointmentId = workspace?.appointmentId ?? searchParams.get("appointment") ?? "";
  const fromClinical = workspace ? null : searchParams.get("from");
  const backHref = workspace
    ? buildPatientWorkspaceUrl(workspace.patientId, { tab: "soap" })
    : backHrefFromClinicalSubpage(fromClinical, defaultPatient, "/historias");
  const fromAppointment = Boolean(appointmentId);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [patientId, setPatientId] = useState(defaultPatient);
  const [pickedPatient, setPickedPatient] = useState<PatientSearchOption | null>(null);
  const [professionalId, setProfessionalId] = useState(defaultProfessional);
  const [evolution, setEvolution] = useState("");
  const [chiefComplaint, setChiefComplaint] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [diagnoses, setDiagnoses] = useState<ClinicalDiagnosisEntry[]>([]);
  const [indications, setIndications] = useState("");
  const [clinicalTreatments, setClinicalTreatments] = useState<ClinicalTreatmentEntry[]>([]);
  const [treatmentMedications, setTreatmentMedications] = useState<PrescriptionMedication[]>([]);
  const [vitals, setVitals] = useState("");
  const [consultationAt, setConsultationAt] = useState(() => toDatetimeLocalValue(new Date()));
  const [templateBases, setTemplateBases] = useState<ClinicalTemplateFieldSet | null>(null);
  const [templateVariableValues, setTemplateVariableValues] = useState<Record<string, string>>({});
  const savingRef = useRef(false);
  const formRef = useRef<HTMLFormElement | null>(null);
  const formDraftRef = useRef<ConsultFormDraft>({
    evolution: "",
    chiefComplaint: "",
    diagnosis: "",
    diagnoses: [],
    indications: "",
    clinicalTreatments: [],
    treatmentMedications: [],
    vitals: "",
    isDirty: false,
  });

  const selectedPatient = useMemo((): ConsultPatientPickerRow | undefined => {
    if (pickedPatient && pickedPatient.id === patientId) {
      return {
        id: pickedPatient.id,
        first_name: pickedPatient.first_name,
        last_name: pickedPatient.last_name,
        document_number: pickedPatient.document_number,
        allergies: null,
        regular_medication: null,
        medical_history: null,
        birth_date: pickedPatient.birth_date ?? null,
        insurance_provider: pickedPatient.insurance_provider ?? null,
      } as ConsultPatientPickerRow & {
        birth_date?: string | null;
        insurance_provider?: string | null;
      };
    }
    return patients.find((p) => p.id === patientId);
  }, [pickedPatient, patients, patientId]);

  const templateVariableKeys = useMemo(
    () =>
      templateBases
        ? extractTemplateVariableKeys(
            templateBases.chief_complaint,
            templateBases.diagnosis,
            templateBases.evolution,
            templateBases.indications
          )
        : [],
    [templateBases]
  );

  function clearTemplateVariables() {
    setTemplateBases(null);
    setTemplateVariableValues({});
  }

  function applyResolvedTemplateFields(fields: ClinicalTemplateFieldSet) {
    setChiefComplaint(fields.chief_complaint);
    setDiagnosis(fields.diagnosis);
    setEvolution(fields.evolution);
    setIndications(fields.indications);
  }

  function updateTemplateVariable(key: string, value: string) {
    if (!templateBases) return;
    const nextValues = { ...templateVariableValues, [key]: value };
    setTemplateVariableValues(nextValues);
    applyResolvedTemplateFields(resolveClinicalTemplateFields(templateBases, nextValues));
  }

  function handleEvolutionChange(value: string) {
    clearTemplateVariables();
    setEvolution(value);
  }

  function handleChiefComplaintChange(value: string) {
    clearTemplateVariables();
    setChiefComplaint(value);
  }

  function handleDiagnosisChange(value: string) {
    clearTemplateVariables();
    setDiagnosis(value);
  }

  function handleDiagnosesChange(next: ClinicalDiagnosisEntry[]) {
    clearTemplateVariables();
    setDiagnoses(next);
    setDiagnosis(buildDiagnosisText(next, ""));
  }

  function handleClinicalTreatmentsChange(next: ClinicalTreatmentEntry[]) {
    clearTemplateVariables();
    setClinicalTreatments(next);
  }

  function handleIndicationsChange(value: string) {
    clearTemplateVariables();
    setIndications(value);
  }

  function handlePatientChange(id: string, patient?: PatientSearchOption) {
    setPatientId(id);
    setPickedPatient(patient ?? null);
  }
  const activeProfessionalId = fromAppointment ? defaultProfessional : professionalId;
  const activeProfessional = professionals.find((p) => p.id === activeProfessionalId);
  const isDirty =
    evolution.trim().length > 0 ||
    chiefComplaint.trim().length > 0 ||
    diagnosis.trim().length > 0 ||
    diagnoses.length > 0 ||
    indications.trim().length > 0 ||
    clinicalTreatments.length > 0 ||
    treatmentMedications.length > 0 ||
    vitals.trim().length > 0;

  useEffect(() => {
    formDraftRef.current = {
      evolution,
      chiefComplaint,
      diagnosis,
      diagnoses,
      indications,
      clinicalTreatments,
      treatmentMedications,
      vitals,
      isDirty,
    };
  }, [
    evolution,
    chiefComplaint,
    diagnosis,
    diagnoses,
    indications,
    clinicalTreatments,
    treatmentMedications,
    vitals,
    isDirty,
  ]);

  function signatureForProfessionalId(id: string): string {
    const pro = professionals.find((p) => p.id === id);
    return pro ? buildProfessionalSignature(pro) : "";
  }

  const [professionalSignature, setProfessionalSignature] = useState(() =>
    activeProfessionalId ? signatureForProfessionalId(activeProfessionalId) : ""
  );
  const [prevActiveProfessionalId, setPrevActiveProfessionalId] = useState(activeProfessionalId);

  if (activeProfessionalId !== prevActiveProfessionalId) {
    setPrevActiveProfessionalId(activeProfessionalId);
    setProfessionalSignature(
      activeProfessionalId ? signatureForProfessionalId(activeProfessionalId) : ""
    );
  }

  const consultationContext = useMemo(() => {
    if (!patientId) return null;
    const proId = fromAppointment ? defaultProfessional : professionalId;
    return {
      patientId,
      appointmentId: appointmentId || undefined,
      professionalId: proId || undefined,
    };
  }, [patientId, appointmentId, fromAppointment, defaultProfessional, professionalId]);

  const draftKey = useMemo(
    () => (consultationContext ? consultationDraftKey(consultationContext) : null),
    [consultationContext]
  );

  useEffect(() => {
    if (!appointmentId) return;
    startConsultationFromAppointment(appointmentId).then((result) => {
      if (result.error) setError(result.error);
    });
  }, [appointmentId]);

  useEffect(() => {
    if (!draftKey) return;
    const saved = readConsultationEvolution(draftKey);
    if (!saved.trim()) return;
    queueMicrotask(() => {
      setEvolution((prev) => (prev.trim().length === 0 ? saved : prev));
    });
  }, [draftKey]);

  useEffect(() => {
    if (!draftKey) return;
    const storageKey: string = draftKey;

    function flushDraft() {
      saveConsultationEvolution(storageKey, formDraftRef.current.evolution);
    }

    const timer = window.setTimeout(flushDraft, 300);

    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") flushDraft();
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      flushDraft();
    };
  }, [evolution, draftKey]);

  const persistConsultation = useCallback(
    async (form: HTMLFormElement, options?: { silent?: boolean }) => {
      const draft = formDraftRef.current;
      if (savingRef.current) return { ok: false as const, error: "Guardando..." };
      if (!draft.isDirty) return { ok: false as const, error: null };

      savingRef.current = true;
      setLoading(true);
      setError(null);

      const formData = new FormData(form);
      if (appointmentId) formData.set("appointment_id", appointmentId);
      const diagnosisText = buildDiagnosisText(draft.diagnoses, draft.diagnosis);
      const primaryCie10 = draft.diagnoses.find((d) => d.cie10_code?.trim())?.cie10_code ?? "";
      formData.set("chief_complaint", draft.chiefComplaint);
      formData.set("diagnosis", diagnosisText);
      formData.set("diagnosis_cie10", primaryCie10);
      formData.set("diagnoses_json", JSON.stringify(draft.diagnoses));
      const mergedTreatments = mergeTreatmentsForPersist(
        draft.clinicalTreatments,
        draft.treatmentMedications
      );
      formData.set("treatments_json", JSON.stringify(mergedTreatments));
      formData.set(
        "indications",
        buildConsultIndicationsText(draft.treatmentMedications, draft.indications, draft.clinicalTreatments)
      );
      formData.set("evolution", buildEvolutionWithVitals(draft.evolution, draft.vitals));
      formData.set("professional_signature", professionalSignature);
      formData.set("consultation_at", new Date(consultationAt).toISOString());

      const result = await createClinicalRecord(formData);
      savingRef.current = false;
      setLoading(false);

      if (result.error) {
        if (!options?.silent) setError(result.error);
        return { ok: false as const, error: result.error };
      }

      if (result.data) {
        if (draftKey) clearConsultationEvolution(draftKey);
        if (!options?.silent) {
          setEvolution("");
          setChiefComplaint("");
          setDiagnosis("");
          setDiagnoses([]);
          setIndications("");
          setClinicalTreatments([]);
          setTreatmentMedications([]);
          setVitals("");
        }
        if (workspace) {
          workspace.onSaved(result.data.id, options?.silent);
        } else if (!options?.silent) {
          router.push(`/historias/${result.data.id}`);
        }
      }

      return { ok: true as const, recordId: result.data?.id };
    },
    [
      appointmentId,
      consultationAt,
      draftKey,
      professionalSignature,
      router,
      workspace,
    ]
  );

  const saveIfDirty = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!formDraftRef.current.isDirty || !formRef.current) return true;
      const result = await persistConsultation(formRef.current, options);
      return result.ok;
    },
    [persistConsultation]
  );

  const saveIfDirtyRef = useRef(saveIfDirty);
  useEffect(() => {
    saveIfDirtyRef.current = saveIfDirty;
  }, [saveIfDirty]);

  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (!formDraftRef.current.isDirty) return;
      void saveIfDirtyRef.current({ silent: true });
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      void saveIfDirtyRef.current({ silent: true });
    };
  }, []);

  function pharmacologyHref(mode?: "symptoms" | "pathology" | "vademecum") {
    if (!consultationContext) {
      return mode && mode !== "pathology"
        ? `/herramientas/farmacologia?mode=${mode}`
        : "/herramientas/farmacologia";
    }
    return buildPharmacologyHrefFromConsultation(consultationContext, mode);
  }

  function flushEvolutionDraft() {
    if (draftKey) saveConsultationEvolution(draftKey, evolution);
    if (patientId) {
      saveInlineConsultPrescriptionSnapshot({
        patientId,
        appointmentId: appointmentId || undefined,
        professionalId: activeProfessionalId || undefined,
        diagnosis,
        indications,
        evolution,
        medications: treatmentMedications,
        savedAt: new Date().toISOString(),
      });
    }
  }

  function recetaHref(tab: "receta" | "orden" = "receta") {
    if (workspace && consultationContext) {
      return buildPatientWorkspaceUrl(workspace.patientId, {
        tab: tab === "orden" ? "ordenes" : "recetas",
        action: "nueva",
        appointment: consultationContext.appointmentId,
        professional: consultationContext.professionalId,
      });
    }
    if (!consultationContext) {
      return tab === "orden" ? "/recetas?tipo=orden" : "/recetas";
    }
    return buildRecetasHrefFromConsultation(consultationContext, tab);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await persistConsultation(e.currentTarget);
  }

  function requestSubmit() {
    formRef.current?.requestSubmit();
  }

  function handleFormKeyDown(event: React.KeyboardEvent<HTMLFormElement>) {
    const target = event.target;
    const isTextarea = target instanceof HTMLTextAreaElement;
    const isModifierEnter =
      (event.ctrlKey || event.metaKey) && event.key === "Enter";
    const isPlainEnter = event.key === "Enter" && !isTextarea && !event.shiftKey;

    if (isModifierEnter || isPlainEnter) {
      event.preventDefault();
      requestSubmit();
    }
  }

  function applyTemplate(templateId: string) {
    const t = templates.find((x) => x.id === templateId);
    if (!t) return;

    const bases: ClinicalTemplateFieldSet = {
      chief_complaint: templateText(t.chief_complaint_template),
      diagnosis: templateText(t.diagnosis_template),
      evolution: templateText(t.evolution_template),
      indications: templateText(t.indications_template),
    };

    setTemplateBases(bases);
    setTemplateVariableValues({});
    applyResolvedTemplateFields(bases);
    setTreatmentMedications([]);
    setClinicalTreatments([]);
  }

  return {
    backHref,
    fromAppointment,
    appointmentId,
    defaultPatient,
    defaultProfessional,
    patientId,
    setPatientId,
    handlePatientChange,
    selectedPatient,
    consultationContext,
    error,
    loading,
    professionalId,
    setProfessionalId,
    evolution,
    setEvolution: handleEvolutionChange,
    chiefComplaint,
    setChiefComplaint: handleChiefComplaintChange,
    diagnosis,
    setDiagnosis: handleDiagnosisChange,
    diagnoses,
    setDiagnoses: handleDiagnosesChange,
    indications,
    setIndications: handleIndicationsChange,
    clinicalTreatments,
    setClinicalTreatments: handleClinicalTreatmentsChange,
    treatmentMedications,
    setTreatmentMedications,
    vitals,
    setVitals,
    consultationAt,
    setConsultationAt,
    professionalSignature,
    setProfessionalSignature,
    professionalSignatureImageUrl: activeProfessional?.signature_image_url ?? null,
    isDirty,
    formRef,
    saveIfDirty,
    requestSubmit,
    handleFormKeyDown,
    pharmacologyHref,
    flushEvolutionDraft,
    recetaHref,
    handleSubmit,
    applyTemplate,
    templateVariableKeys,
    templateVariableValues,
    updateTemplateVariable,
  };
}

export type NuevaConsultaFormState = ReturnType<typeof useNuevaConsultaForm>;
