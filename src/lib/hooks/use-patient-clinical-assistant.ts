"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { PatientChartViewProps } from "@/components/pacientes/patient-chart-types";
import type { PatientEhrWorkspaceData } from "@/lib/server/load-patient-ehr-data";
import { getDrugsByPathology } from "@/lib/actions/pharmacology";
import { useDeferredPathologySearch } from "@/lib/hooks/use-deferred-pathology-search";
import {
  buildClinicalSummary,
  extractPathologySearchQuery,
} from "@/lib/utils/clinical-assistant";
import type { PathologyDrug, PathologySearchResult } from "@/types/pharmacology";

type Options = Pick<PatientChartViewProps, "chart" | "patient" | "patientId" | "canIssue"> & {
  ehr: PatientEhrWorkspaceData;
};

export function usePatientClinicalAssistant({ chart, ehr }: Options) {
  const [selectedPathology, setSelectedPathology] = useState<PathologySearchResult | null>(null);
  const [drugs, setDrugs] = useState<PathologyDrug[]>([]);

  const lastConsultLabel = ehr.consultations[0]?.created_at
    ? format(new Date(ehr.consultations[0].created_at), "dd/MM/yyyy", { locale: es })
    : null;

  const summaryLines = useMemo(
    () =>
      buildClinicalSummary({
        ageLabel: chart.ageLabel ?? "—",
        sex: chart.sex,
        insurance: chart.insurance,
        activeProblems: chart.activeProblemsText,
        allergies: chart.allergies,
        medicationCount: chart.medications.length,
        lastConsultLabel,
        alerts: chart.alerts,
      }),
    [chart, lastConsultLabel]
  );

  const pathologyQuery = useMemo(
    () =>
      extractPathologySearchQuery({
        lastDiagnosis: ehr.diagnosisRows[0]?.name,
        lastEvolution: ehr.consultations[0]?.evolution,
        activeProblems: chart.activeProblemsText,
      }),
    [ehr, chart.activeProblemsText]
  );

  const { pathologies, loading: loadingPathologies } = useDeferredPathologySearch({
    query: pathologyQuery,
    minLength: 2,
    debounceMs: 350,
  });

  useEffect(() => {
    if (!selectedPathology?.id) {
      const resetTimer = window.setTimeout(() => setDrugs([]), 0);
      return () => window.clearTimeout(resetTimer);
    }
    let cancelled = false;
    getDrugsByPathology(selectedPathology.id).then(({ data }) => {
      if (!cancelled) setDrugs((data ?? []).slice(0, 5));
    });
    return () => {
      cancelled = true;
    };
  }, [selectedPathology?.id]);

  return {
    summaryLines,
    pathologyQuery,
    pathologies,
    loadingPathologies,
    selectedPathology,
    setSelectedPathology,
    drugs,
  };
}
