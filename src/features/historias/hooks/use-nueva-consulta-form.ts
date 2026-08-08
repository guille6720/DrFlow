"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { ConsultPatientPickerRow } from "@/core/supabase/query-types";

import { backHrefFromClinicalSubpage } from "@/shared/utils/clinical-navigation";

import { createClinicalRecord } from "@/features/historias/actions/clinical-records";
import { buildPatientWorkspaceUrl } from "@/features/pacientes/utils/patient-workspace-actions";

import { startConsultationFromAppointment } from "@/lib/actions/appointments";
import {
  buildPharmacologyHrefFromConsultation,
  buildRecetasHrefFromConsultation,
  clearConsultationEvolution,
  consultationDraftKey,
  readConsultationEvolution,
  saveConsultationEvolution,
} from "@/lib/utils/consultation-draft";
import { buildProfessionalSignature } from "@/lib/utils/professional";

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
  onSaved: (recordId: string) => void;
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
  const [professionalId, setProfessionalId] = useState(defaultProfessional);
  const [evolution, setEvolution] = useState("");
  const [chiefComplaint, setChiefComplaint] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [indications, setIndications] = useState("");
  const [vitals, setVitals] = useState("");
  const [consultationAt, setConsultationAt] = useState(() => toDatetimeLocalValue(new Date()));
  const savingRef = useRef(false);
  const formRef = useRef<HTMLFormElement | null>(null);

  const selectedPatient = patients.find((p) => p.id === patientId);
  const activeProfessionalId = fromAppointment ? defaultProfessional : professionalId;
  const activeProfessional = professionals.find((p) => p.id === activeProfessionalId);
  const isDirty =
    evolution.trim().length > 0 ||
    chiefComplaint.trim().length > 0 ||
    diagnosis.trim().length > 0 ||
    indications.trim().length > 0 ||
    vitals.trim().length > 0;

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
    queueMicrotask(() => setEvolution(readConsultationEvolution(draftKey)));
  }, [draftKey]);

  useEffect(() => {
    if (!draftKey) return;
    const timer = window.setTimeout(() => saveConsultationEvolution(draftKey, evolution), 300);
    return () => window.clearTimeout(timer);
  }, [evolution, draftKey]);

  useEffect(() => {
    if (draftKey == null) return;
    const storageKey: string = draftKey;
    function syncFromStorage() {
      const saved = readConsultationEvolution(storageKey);
      setEvolution((prev) => (prev !== saved ? saved : prev));
    }
    document.addEventListener("visibilitychange", syncFromStorage);
    window.addEventListener("focus", syncFromStorage);
    return () => {
      document.removeEventListener("visibilitychange", syncFromStorage);
      window.removeEventListener("focus", syncFromStorage);
    };
  }, [draftKey]);

  const persistConsultation = useCallback(
    async (form: HTMLFormElement, options?: { silent?: boolean }) => {
      if (savingRef.current) return { ok: false as const, error: "Guardando..." };
      if (!isDirty) return { ok: false as const, error: null };

      savingRef.current = true;
      setLoading(true);
      setError(null);

      const formData = new FormData(form);
      if (appointmentId) formData.set("appointment_id", appointmentId);
      formData.set("chief_complaint", chiefComplaint);
      formData.set("diagnosis", diagnosis);
      formData.set("indications", indications);
      formData.set("evolution", buildEvolutionWithVitals(evolution, vitals));
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
        setEvolution("");
        setChiefComplaint("");
        setDiagnosis("");
        setIndications("");
        setVitals("");
        if (workspace) {
          workspace.onSaved(result.data.id);
        } else if (!options?.silent) {
          router.push(`/historias/${result.data.id}`);
        }
      }

      return { ok: true as const, recordId: result.data?.id };
    },
    [
      appointmentId,
      chiefComplaint,
      consultationAt,
      diagnosis,
      draftKey,
      evolution,
      indications,
      isDirty,
      professionalSignature,
      router,
      vitals,
      workspace,
    ]
  );

  const saveIfDirty = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!isDirty || !formRef.current) return true;
      const result = await persistConsultation(formRef.current, options);
      return result.ok;
    },
    [isDirty, persistConsultation]
  );

  useEffect(() => {
    const form = formRef.current;

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (!isDirty) return;
      void saveIfDirty({ silent: true });
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      if (isDirty && form) {
        void persistConsultation(form, { silent: true });
      }
    };
  }, [isDirty, persistConsultation, saveIfDirty]);

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
    setChiefComplaint(templateText(t.chief_complaint_template));
    setDiagnosis(templateText(t.diagnosis_template));
    setEvolution(templateText(t.evolution_template));
    setIndications(templateText(t.indications_template));
  }

  return {
    backHref,
    fromAppointment,
    appointmentId,
    defaultPatient,
    defaultProfessional,
    patientId,
    setPatientId,
    selectedPatient,
    consultationContext,
    error,
    loading,
    professionalId,
    setProfessionalId,
    evolution,
    setEvolution,
    chiefComplaint,
    setChiefComplaint,
    diagnosis,
    setDiagnosis,
    indications,
    setIndications,
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
  };
}

export type NuevaConsultaFormState = ReturnType<typeof useNuevaConsultaForm>;
