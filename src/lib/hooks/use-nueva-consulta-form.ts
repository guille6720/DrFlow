"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClinicalRecord } from "@/lib/actions/clinical-records";
import { startConsultationFromAppointment } from "@/lib/actions/appointments";
import { buildProfessionalSignature } from "@/lib/utils/professional";
import type { Patient, Professional } from "@/types/database";
import { backHrefFromClinicalSubpage } from "@/lib/utils/clinical-navigation";
import {
  buildPharmacologyHrefFromConsultation,
  buildRecetasHrefFromConsultation,
  clearConsultationEvolution,
  consultationDraftKey,
  readConsultationEvolution,
  saveConsultationEvolution,
} from "@/lib/utils/consultation-draft";

type Template = {
  id: string;
  name: string;
  chief_complaint_template: string | null;
  diagnosis_template: string | null;
  evolution_template: string | null;
  indications_template: string | null;
};

type Options = {
  patients: Patient[];
  professionals: Professional[];
  templates: Template[];
};

export function useNuevaConsultaForm({ patients, professionals, templates }: Options) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const defaultPatient = searchParams.get("patient") ?? "";
  const defaultProfessional = searchParams.get("professional") ?? "";
  const appointmentId = searchParams.get("appointment") ?? "";
  const fromClinical = searchParams.get("from");
  const backHref = backHrefFromClinicalSubpage(fromClinical, defaultPatient, "/historias");
  const fromAppointment = Boolean(appointmentId);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [professionalId, setProfessionalId] = useState(defaultProfessional);
  const [evolution, setEvolution] = useState("");

  const selectedPatient = patients.find((p) => p.id === defaultPatient);
  const activeProfessionalId = fromAppointment ? defaultProfessional : professionalId;

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
    if (!defaultPatient) return null;
    const proId = fromAppointment ? defaultProfessional : professionalId;
    return {
      patientId: defaultPatient,
      appointmentId: appointmentId || undefined,
      professionalId: proId || undefined,
    };
  }, [defaultPatient, appointmentId, fromAppointment, defaultProfessional, professionalId]);

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
      router.push(`/historias/${result.data.id}`);
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
    pharmacologyHref,
    flushEvolutionDraft,
    recetaHref,
    handleSubmit,
    applyTemplate,
  };
}

export type NuevaConsultaFormState = ReturnType<typeof useNuevaConsultaForm>;
