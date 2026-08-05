"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import type { PrescriptionsOrdersTab } from "@/features/recetas/components/recetas/prescriptions-orders-types";

import {
  consultationDraftKey,
  parseConsultationDraftContext,
  readConsultationEvolution,
} from "@/lib/utils/consultation-draft";
import {
  extractEvolutionDiagnosis,
  parseEvolutionMedications,
} from "@/lib/utils/parse-evolution-medications";
import type { PrescriptionMedication } from "@/types/prescription";

type Params = {
  prefillDiagnosis?: string;
  initialMedications?: PrescriptionMedication[];
  defaultTab: PrescriptionsOrdersTab;
  selectedPatientId?: string;
};

export function usePrescriptionsOrdersHub({
  prefillDiagnosis = "",
  initialMedications,
  defaultTab,
  selectedPatientId,
}: Params) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const consultationContext = useMemo(
    () => parseConsultationDraftContext(searchParams),
    [searchParams]
  );
  const draftKey = useMemo(
    () => (consultationContext ? consultationDraftKey(consultationContext) : null),
    [consultationContext]
  );

  const [consultaDiagnosis, setConsultaDiagnosis] = useState("");
  const [prevDraftKey, setPrevDraftKey] = useState(draftKey);

  if (draftKey !== prevDraftKey) {
    setPrevDraftKey(draftKey);
    setConsultaDiagnosis(draftKey ? readConsultationEvolution(draftKey) : "");
  }

  useEffect(() => {
    if (draftKey == null) return;
    const storageKey: string = draftKey;
    function syncEvolution() {
      setConsultaDiagnosis(readConsultationEvolution(storageKey));
    }
    document.addEventListener("visibilitychange", syncEvolution);
    window.addEventListener("focus", syncEvolution);
    return () => {
      document.removeEventListener("visibilitychange", syncEvolution);
      window.removeEventListener("focus", syncEvolution);
    };
  }, [draftKey]);

  const consultaMedications = useMemo(() => {
    if (!consultationContext) return [];
    return parseEvolutionMedications(consultaDiagnosis);
  }, [consultationContext, consultaDiagnosis]);

  const diagnosisForForm =
    consultationContext && consultaDiagnosis.trim()
      ? extractEvolutionDiagnosis(consultaDiagnosis) || consultaDiagnosis.slice(0, 500)
      : prefillDiagnosis;

  const medicationsForForm =
    consultationContext && consultaMedications.length > 0
      ? consultaMedications
      : initialMedications;

  const activeTab: PrescriptionsOrdersTab =
    searchParams.get("tipo") === "orden" ? "orden" : defaultTab;

  function buildNavigateParams(patientId: string | null, tab: PrescriptionsOrdersTab) {
    const params = new URLSearchParams();
    if (patientId) params.set("patient", patientId);
    if (tab === "orden") params.set("tipo", "orden");
    if (consultationContext) {
      params.set("consulta", "1");
      if (consultationContext.appointmentId) {
        params.set("appointment", consultationContext.appointmentId);
      }
      params.set("patient", consultationContext.patientId);
      if (consultationContext.professionalId) {
        params.set("professional", consultationContext.professionalId);
      }
      if (consultationContext.recordId) {
        params.set("record", consultationContext.recordId);
      }
    }
    return params;
  }

  function navigate(patientId: string | null, tab: PrescriptionsOrdersTab = activeTab) {
    const params = buildNavigateParams(patientId, tab);
    const qs = params.toString();
    router.push(qs ? `/recetas?${qs}` : "/recetas");
  }

  function setTab(tab: PrescriptionsOrdersTab) {
    navigate(selectedPatientId ?? null, tab);
  }

  return {
    router,
    consultationContext,
    draftKey,
    consultaMedications,
    diagnosisForForm,
    medicationsForForm,
    activeTab,
    navigate,
    setTab,
  };
}
