"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

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
  /** Administrador de la clínica cuando no hay selección explícita. */
  fallbackProfessionalId?: string;
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
  const [professionalId, setProfessionalId] = useState(defaultProfessional);
  const [evolution, setEvolution] = useState("");

  const selectedPatient = patients.find((p) => p.id === patientId);
  const activeProfessionalId = fromAppointment ? defaultProfessional : professionalId;

  const activeProfessional = professionals.find((p) => p.id === activeProfessionalId);

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
    setLoading(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    if (appointmentId) formData.set("appointment_id", appointmentId);
    formData.set("chief_complaint", "");
    formData.set("diagnosis", "");
    formData.set("indications", "");
    formData.set("professional_signature", professionalSignature);
    const result = await createClinicalRecord(formData);
    setLoading(false);
    if (result.error) {
      setError(result.error);
    } else if (result.data) {
      if (draftKey) clearConsultationEvolution(draftKey);
      if (workspace) {
        workspace.onSaved(result.data.id);
      } else {
        router.push(`/historias/${result.data.id}`);
      }
    }
  }

  function applyTemplate(templateId: string) {
    const t = templates.find((x) => x.id === templateId);
    if (!t) return;
    const unified = [
      t.chief_complaint_template,
      t.diagnosis_template,
      t.evolution_template,
      t.indications_template,
    ]
      .filter(Boolean)
      .join("\n\n");
    setEvolution(unified);
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
    professionalSignature,
    setProfessionalSignature,
    professionalSignatureImageUrl: activeProfessional?.signature_image_url ?? null,
    pharmacologyHref,
    flushEvolutionDraft,
    recetaHref,
    handleSubmit,
    applyTemplate,
  };
}

export type NuevaConsultaFormState = ReturnType<typeof useNuevaConsultaForm>;
