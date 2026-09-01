"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { toast } from "@/core/notifications/toast";
import type { ConsultPatientPickerRow } from "@/core/supabase/query-types";

import { backHrefFromClinicalSubpage } from "@/shared/utils/clinical-navigation";

import {
  buildDiagnosisText,
  type ClinicalDiagnosisEntry,
  type ClinicalTreatmentEntry,
  mergeTreatmentsForPersist,
} from "@/features/historias/utils/clinical-structured-entries";
import { persistClinicalRecordRequest } from "@/features/historias/utils/persist-clinical-record-request";
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
  readConsultationDraft,
  saveConsultationDraft,
} from "@/lib/utils/consultation-draft";
import { buildProfessionalSignature, getProfessionalDisplayName } from "@/lib/utils/professional";
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
  onSaved: (
    recordId: string,
    silent?: boolean,
    meta?: {
      consultationAtIso?: string;
      snapshot?: {
        chief_complaint: string;
        evolution: string;
        diagnosis: string;
        indications: string;
        professional_id: string;
        professional_name: string;
        professional_signature: string;
      };
    }
  ) => void;
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
  const pathname = usePathname();
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
  /** clinical_record id for autosave updates / in-session edit */
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [autoSaveStatus, setAutoSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const savingRef = useRef(false);
  const editingRecordIdRef = useRef<string | null>(null);
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

  function resetConsultFields() {
    clearTemplateVariables();
    setError(null);
    setEvolution("");
    setChiefComplaint("");
    setDiagnosis("");
    setDiagnoses([]);
    setIndications("");
    setClinicalTreatments([]);
    setTreatmentMedications([]);
    setVitals("");
    setConsultationAt(toDatetimeLocalValue(new Date()));
    setEditingRecordId(null);
    editingRecordIdRef.current = null;
    setAutoSaveStatus("idle");
    formDraftRef.current = {
      evolution: "",
      chiefComplaint: "",
      diagnosis: "",
      diagnoses: [],
      indications: "",
      clinicalTreatments: [],
      treatmentMedications: [],
      vitals: "",
      isDirty: false,
    };
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
    if (id !== patientId) {
      resetConsultFields();
    }
    setPatientId(id);
    setPickedPatient(patient ?? null);
  }

  // Soft-nav entre pacientes/turnos: el hook puede reutilizarse; vaciar evolución.
  const workspaceIdentity = `${workspace?.patientId ?? ""}:${workspace?.appointmentId ?? ""}`;
  const prevWorkspaceIdentityRef = useRef(workspaceIdentity);
  useEffect(() => {
    if (!workspace) return;
    if (prevWorkspaceIdentityRef.current === workspaceIdentity) return;
    prevWorkspaceIdentityRef.current = workspaceIdentity;
    setPatientId(workspace.patientId);
    setPickedPatient(null);
    setTemplateBases(null);
    setTemplateVariableValues({});
    setError(null);
    setEvolution("");
    setChiefComplaint("");
    setDiagnosis("");
    setDiagnoses([]);
    setIndications("");
    setClinicalTreatments([]);
    setTreatmentMedications([]);
    setVitals("");
    setConsultationAt(toDatetimeLocalValue(new Date()));
    setEditingRecordId(null);
    editingRecordIdRef.current = null;
    setAutoSaveStatus("idle");
    formDraftRef.current = {
      evolution: "",
      chiefComplaint: "",
      diagnosis: "",
      diagnoses: [],
      indications: "",
      clinicalTreatments: [],
      treatmentMedications: [],
      vitals: "",
      isDirty: false,
    };
  }, [workspace, workspaceIdentity]);

  useEffect(() => {
    editingRecordIdRef.current = editingRecordId;
  }, [editingRecordId]);

  const activeProfessionalId = fromAppointment ? defaultProfessional : professionalId;
  const activeProfessional = professionals.find((p) => p.id === activeProfessionalId);

  const contentFingerprint = useMemo(
    () =>
      JSON.stringify({
        evolution,
        chiefComplaint,
        diagnosis,
        diagnoses,
        indications,
        clinicalTreatments,
        treatmentMedications,
        vitals,
        consultationAt,
      }),
    [
      evolution,
      chiefComplaint,
      diagnosis,
      diagnoses,
      indications,
      clinicalTreatments,
      treatmentMedications,
      vitals,
      consultationAt,
    ]
  );
  const [savedFingerprint, setSavedFingerprint] = useState(contentFingerprint);
  const hasContent =
    evolution.trim().length > 0 ||
    chiefComplaint.trim().length > 0 ||
    diagnosis.trim().length > 0 ||
    diagnoses.length > 0 ||
    indications.trim().length > 0 ||
    clinicalTreatments.length > 0 ||
    treatmentMedications.length > 0 ||
    vitals.trim().length > 0;
  const isDirty = editingRecordId
    ? contentFingerprint !== savedFingerprint
    : hasContent && contentFingerprint !== savedFingerprint;

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
    const saved = readConsultationDraft(draftKey);
    if (!saved) return;
    queueMicrotask(() => {
      if (saved.evolution.trim()) {
        setEvolution((prev) => (prev.trim().length === 0 ? saved.evolution : prev));
      }
      if (saved.chiefComplaint.trim()) {
        setChiefComplaint((prev) => (prev.trim().length === 0 ? saved.chiefComplaint : prev));
      }
      if (saved.diagnosis.trim()) {
        setDiagnosis((prev) => (prev.trim().length === 0 ? saved.diagnosis : prev));
      }
      if (saved.indications.trim()) {
        setIndications((prev) => (prev.trim().length === 0 ? saved.indications : prev));
      }
      if (saved.vitals.trim()) {
        setVitals((prev) => (prev.trim().length === 0 ? saved.vitals : prev));
      }
      if (saved.recordId) {
        setEditingRecordId((prev) => prev ?? saved.recordId ?? null);
        editingRecordIdRef.current = saved.recordId;
        setSavedFingerprint(
          JSON.stringify({
            evolution: saved.evolution,
            chiefComplaint: saved.chiefComplaint,
            diagnosis: saved.diagnosis,
            diagnoses: [],
            indications: saved.indications,
            clinicalTreatments: [],
            treatmentMedications: [],
            vitals: saved.vitals,
          })
        );
      } else {
        // Borrador local sin ID: marcar dirty para que el autoguardado cree el registro.
        setSavedFingerprint(
          JSON.stringify({
            evolution: "",
            chiefComplaint: "",
            diagnosis: "",
            diagnoses: [],
            indications: "",
            clinicalTreatments: [],
            treatmentMedications: [],
            vitals: "",
          })
        );
      }
    });
  }, [draftKey]);

  useEffect(() => {
    if (!draftKey) return;
    const storageKey: string = draftKey;

    function flushDraft() {
      const draft = formDraftRef.current;
      saveConsultationDraft(storageKey, {
        v: 1,
        evolution: draft.evolution,
        chiefComplaint: draft.chiefComplaint,
        diagnosis: draft.diagnosis,
        indications: draft.indications,
        vitals: draft.vitals,
        recordId: editingRecordIdRef.current,
        updatedAt: new Date().toISOString(),
      });
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
  }, [evolution, chiefComplaint, diagnosis, indications, vitals, editingRecordId, draftKey]);

  const persistConsultation = useCallback(
    async (form: HTMLFormElement, options?: { silent?: boolean }) => {
      const draft = formDraftRef.current;
      if (savingRef.current) return { ok: false as const, error: "Guardando..." };
      if (!draft.isDirty && !editingRecordIdRef.current) {
        return { ok: false as const, error: null };
      }
      // Autosave: allow update even if momentarily not dirty when we have a record
      if (!draft.isDirty && options?.silent) {
        return { ok: false as const, error: null };
      }

      savingRef.current = true;
      setLoading(true);
      if (options?.silent) setAutoSaveStatus("saving");
      setError(null);

      try {
        const formData = new FormData(form);
        if (appointmentId) formData.set("appointment_id", appointmentId);
        const diagnosisText = buildDiagnosisText(draft.diagnoses, draft.diagnosis);
        const primaryCie10 = draft.diagnoses.find((d) => d.cie10_code?.trim())?.cie10_code ?? "";
        const mergedTreatments = mergeTreatmentsForPersist(
          draft.clinicalTreatments,
          draft.treatmentMedications
        );
        const indicationsText = buildConsultIndicationsText(
          draft.treatmentMedications,
          draft.indications,
          draft.clinicalTreatments
        );
        const evolutionText = buildEvolutionWithVitals(draft.evolution, draft.vitals);
        formData.set("chief_complaint", draft.chiefComplaint);
        formData.set("diagnosis", diagnosisText);
        formData.set("diagnosis_cie10", primaryCie10);
        formData.set("diagnoses_json", JSON.stringify(draft.diagnoses));
        formData.set("treatments_json", JSON.stringify(mergedTreatments));
        formData.set("indications", indicationsText);
        formData.set("evolution", evolutionText);
        formData.set("professional_signature", professionalSignature);
        formData.set("consultation_at", new Date(consultationAt).toISOString());

        const recordId = editingRecordIdRef.current;
        const appointmentRaw = formData.get("appointment_id");
        const professionalIdValue = String(formData.get("professional_id") ?? "");
        const apiPayload = {
          recordId: recordId ?? undefined,
          consultation_modality:
            typeof formData.get("consultation_modality") === "string"
              ? String(formData.get("consultation_modality"))
              : undefined,
          patient_id: String(formData.get("patient_id") ?? ""),
          appointment_id:
            typeof appointmentRaw === "string" && appointmentRaw.trim() ? appointmentRaw : null,
          professional_id: professionalIdValue,
          chief_complaint: String(formData.get("chief_complaint") ?? ""),
          diagnosis: String(formData.get("diagnosis") ?? ""),
          evolution: String(formData.get("evolution") ?? ""),
          indications: String(formData.get("indications") ?? ""),
          professional_signature: String(formData.get("professional_signature") ?? ""),
          consultation_at: String(formData.get("consultation_at") ?? "") || null,
          diagnosis_cie10: String(formData.get("diagnosis_cie10") ?? "") || null,
          diagnoses_json: String(formData.get("diagnoses_json") ?? "") || null,
          treatments_json: String(formData.get("treatments_json") ?? "") || null,
        };
        const apiResult = await persistClinicalRecordRequest(apiPayload);

        if ("error" in apiResult) {
          setError(apiResult.error);
          if (options?.silent) setAutoSaveStatus("error");
          else toast.error(apiResult.error);
          return { ok: false as const, error: apiResult.error };
        }

        const savedId = recordId ?? apiResult.data.id;

        if (savedId) {
          setEditingRecordId(savedId);
          editingRecordIdRef.current = savedId;
          setSavedFingerprint(
            JSON.stringify({
              evolution: draft.evolution,
              chiefComplaint: draft.chiefComplaint,
              diagnosis: draft.diagnosis,
              diagnoses: draft.diagnoses,
              indications: draft.indications,
              clinicalTreatments: draft.clinicalTreatments,
              treatmentMedications: draft.treatmentMedications,
              vitals: draft.vitals,
              consultationAt,
            })
          );
          if (draftKey) {
            saveConsultationDraft(draftKey, {
              v: 1,
              evolution: draft.evolution,
              chiefComplaint: draft.chiefComplaint,
              diagnosis: draft.diagnosis,
              indications: draft.indications,
              vitals: draft.vitals,
              recordId: savedId,
              updatedAt: new Date().toISOString(),
            });
          }
          setAutoSaveStatus("saved");
          if (workspace) {
            const pro = professionals.find((p) => p.id === professionalIdValue);
            workspace.onSaved(savedId, options?.silent, {
              consultationAtIso: new Date(consultationAt).toISOString(),
              snapshot: {
                chief_complaint: draft.chiefComplaint,
                evolution: evolutionText,
                diagnosis: diagnosisText,
                indications: indicationsText,
                professional_id: professionalIdValue,
                professional_name: pro ? getProfessionalDisplayName(pro) : "Consulta en curso",
                professional_signature: professionalSignature,
              },
            });
          } else if (!options?.silent && !recordId) {
            router.push(`/historias/${savedId}`);
          }
        }

        return { ok: true as const, recordId: savedId ?? undefined };
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "No se pudo guardar la evolución. Intentá de nuevo.";
        setError(message);
        if (options?.silent) setAutoSaveStatus("error");
        else toast.error(message);
        return { ok: false as const, error: message };
      } finally {
        savingRef.current = false;
        setLoading(false);
      }
    },
    [
      appointmentId,
      consultationAt,
      draftKey,
      professionalSignature,
      professionals,
      router,
      workspace,
    ]
  );

  const flushKeepaliveSave = useCallback(() => {
    const draft = formDraftRef.current;
    const form = formRef.current;
    if (!form || savingRef.current) return;
    if (!draft.isDirty && !editingRecordIdRef.current) return;
    if (!patientId || !activeProfessionalId) return;

    const diagnosisText = buildDiagnosisText(draft.diagnoses, draft.diagnosis);
    const mergedTreatments = mergeTreatmentsForPersist(
      draft.clinicalTreatments,
      draft.treatmentMedications
    );
    void persistClinicalRecordRequest(
      {
        recordId: editingRecordIdRef.current ?? undefined,
        patient_id: patientId,
        appointment_id: appointmentId || null,
        professional_id: activeProfessionalId,
        chief_complaint: draft.chiefComplaint,
        diagnosis: diagnosisText,
        evolution: buildEvolutionWithVitals(draft.evolution, draft.vitals),
        indications: buildConsultIndicationsText(
          draft.treatmentMedications,
          draft.indications,
          draft.clinicalTreatments
        ),
        professional_signature: professionalSignature,
        consultation_at: new Date(consultationAt).toISOString(),
        diagnosis_cie10: draft.diagnoses.find((d) => d.cie10_code?.trim())?.cie10_code ?? null,
        diagnoses_json: JSON.stringify(draft.diagnoses),
        treatments_json: JSON.stringify(mergedTreatments),
      },
      { keepalive: true }
    );
  }, [
    activeProfessionalId,
    appointmentId,
    consultationAt,
    patientId,
    professionalSignature,
  ]);

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

  // Autoguardado en DB (~1.5s) mientras hay cambios.
  useEffect(() => {
    if (!isDirty || !formRef.current) return;
    const timer = window.setTimeout(() => {
      void saveIfDirtyRef.current({ silent: true });
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [isDirty, contentFingerprint]);

  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (!formDraftRef.current.isDirty) return;
      flushKeepaliveSave();
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      flushKeepaliveSave();
    };
  }, [flushKeepaliveSave]);

  const prevPathnameRef = useRef(pathname);
  useEffect(() => {
    if (prevPathnameRef.current === pathname) return;
    prevPathnameRef.current = pathname;
    void saveIfDirtyRef.current({ silent: true });
  }, [pathname]);

  function pharmacologyHref(mode?: "symptoms" | "pathology" | "vademecum") {
    if (!consultationContext) {
      return mode && mode !== "pathology"
        ? `/herramientas/farmacologia?mode=${mode}`
        : "/herramientas/farmacologia";
    }
    return buildPharmacologyHrefFromConsultation(consultationContext, mode);
  }

  function flushEvolutionDraft() {
    if (draftKey) {
      saveConsultationDraft(draftKey, {
        v: 1,
        evolution,
        chiefComplaint,
        diagnosis,
        indications,
        vitals,
        recordId: editingRecordIdRef.current,
        updatedAt: new Date().toISOString(),
      });
    }
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

  function loadConsultationForEdit(record: {
    id: string;
    created_at?: string | null;
    chief_complaint?: string | null;
    diagnosis?: string | null;
    evolution?: string | null;
    indications?: string | null;
    professional_signature?: string | null;
  }) {
    clearTemplateVariables();
    setEditingRecordId(record.id);
    editingRecordIdRef.current = record.id;
    const nextConsultationAt = record.created_at
      ? toDatetimeLocalValue(new Date(record.created_at))
      : toDatetimeLocalValue(new Date());
    setConsultationAt(nextConsultationAt);
    setChiefComplaint(record.chief_complaint?.trim() ?? "");
    setDiagnosis(record.diagnosis?.trim() ?? "");
    setDiagnoses([]);
    setEvolution(record.evolution?.trim() ?? "");
    setIndications(record.indications?.trim() ?? "");
    setClinicalTreatments([]);
    setTreatmentMedications([]);
    setVitals("");
    if (record.professional_signature?.trim()) {
      setProfessionalSignature(record.professional_signature.trim());
    }
    const nextFp = JSON.stringify({
      evolution: record.evolution?.trim() ?? "",
      chiefComplaint: record.chief_complaint?.trim() ?? "",
      diagnosis: record.diagnosis?.trim() ?? "",
      diagnoses: [],
      indications: record.indications?.trim() ?? "",
      clinicalTreatments: [],
      treatmentMedications: [],
      vitals: "",
      consultationAt: nextConsultationAt,
    });
    setSavedFingerprint(nextFp);
    setAutoSaveStatus("saved");
    setError(null);
  }

  function startNewConsultation() {
    if (draftKey) clearConsultationEvolution(draftKey);
    resetConsultFields();
    setSavedFingerprint(
      JSON.stringify({
        evolution: "",
        chiefComplaint: "",
        diagnosis: "",
        diagnoses: [],
        indications: "",
        clinicalTreatments: [],
        treatmentMedications: [],
        vitals: "",
        consultationAt: toDatetimeLocalValue(new Date()),
      })
    );
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
    editingRecordId,
    autoSaveStatus,
    formRef,
    saveIfDirty,
    requestSubmit,
    handleFormKeyDown,
    pharmacologyHref,
    flushEvolutionDraft,
    loadConsultationForEdit,
    startNewConsultation,
    recetaHref,
    handleSubmit,
    applyTemplate,
    templateVariableKeys,
    templateVariableValues,
    updateTemplateVariable,
  };
}

export type NuevaConsultaFormState = ReturnType<typeof useNuevaConsultaForm>;
