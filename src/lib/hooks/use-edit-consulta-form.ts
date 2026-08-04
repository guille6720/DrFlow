"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { updateClinicalRecord } from "@/lib/actions/clinical-records";
import { buildUnifiedClinicalEvolution } from "@/lib/utils/unified-clinical-evolution";
import {
  buildPharmacologyHrefFromConsultation,
  buildRecetasHrefFromConsultation,
  clearConsultationEvolution,
  consultationDraftKey,
  readConsultationEvolution,
  saveConsultationEvolution,
} from "@/lib/utils/consultation-draft";
interface RecordData {
  id: string;
  patient_id: string;
  professional_id: string;
  appointment_id: string | null;
  chief_complaint: string | null;
  diagnosis: string | null;
  evolution: string | null;
  indications: string | null;
  professional_signature: string | null;
}

type Template = {
  id: string;
  name: string;
  chief_complaint_template: string | null;
  diagnosis_template: string | null;
  evolution_template: string | null;
  indications_template: string | null;
};

type Options = {
  record: RecordData;
  templates?: Template[];
};

export function useEditConsultaForm({ record, templates = [] }: Options) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [professionalSignature, setProfessionalSignature] = useState(
    record.professional_signature ?? ""
  );

  const initialEvolution = useMemo(
    () =>
      buildUnifiedClinicalEvolution({
        chief_complaint: record.chief_complaint,
        diagnosis: record.diagnosis,
        evolution: record.evolution,
        indications: record.indications,
      }),
    [record]
  );
  const [evolution, setEvolution] = useState(initialEvolution);

  const consultationContext = useMemo(
    () => ({
      patientId: record.patient_id,
      appointmentId: record.appointment_id ?? undefined,
      professionalId: record.professional_id,
      recordId: record.id,
    }),
    [record]
  );

  const draftKey = useMemo(() => consultationDraftKey(consultationContext), [consultationContext]);

  useEffect(() => {
    queueMicrotask(() => {
      const saved = readConsultationEvolution(draftKey);
      if (saved.trim()) {
        setEvolution(saved);
      } else {
        saveConsultationEvolution(draftKey, initialEvolution);
        setEvolution(initialEvolution);
      }
    });
  }, [draftKey, initialEvolution]);

  useEffect(() => {
    const timer = window.setTimeout(() => saveConsultationEvolution(draftKey, evolution), 300);
    return () => window.clearTimeout(timer);
  }, [evolution, draftKey]);

  useEffect(() => {
    const storageKey = draftKey;
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
    return buildPharmacologyHrefFromConsultation(consultationContext, mode);
  }

  function recetaHref(tab: "receta" | "orden" = "receta") {
    return buildRecetasHrefFromConsultation(consultationContext, tab);
  }

  function flushEvolutionDraft() {
    saveConsultationEvolution(draftKey, evolution);
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

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    formData.set("chief_complaint", "");
    formData.set("diagnosis", "");
    formData.set("indications", "");
    formData.set("evolution", evolution);
    formData.set("professional_signature", professionalSignature);
    const result = await updateClinicalRecord(record.id, formData);
    setLoading(false);
    if (result.error) {
      setError(result.error);
    } else {
      clearConsultationEvolution(draftKey);
      router.push(`/historias/${record.id}`);
    }
  }

  return {
    error,
    loading,
    professionalSignature,
    setProfessionalSignature,
    evolution,
    setEvolution,
    pharmacologyHref,
    recetaHref,
    flushEvolutionDraft,
    applyTemplate,
    handleSubmit,
  };
}

export type EditConsultaFormState = ReturnType<typeof useEditConsultaForm>;

export type { RecordData, Template };
