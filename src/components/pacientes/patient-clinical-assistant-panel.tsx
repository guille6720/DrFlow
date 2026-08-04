"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { AlertTriangle, Pill, ScrollText, Sparkles, Stethoscope } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { PatientChartViewProps } from "@/components/pacientes/patient-chart-types";
import type { PatientEhrWorkspaceData } from "@/lib/server/load-patient-ehr-data";
import { getDrugsByPathology } from "@/lib/actions/pharmacology";
import { useDeferredPathologySearch } from "@/lib/hooks/use-deferred-pathology-search";
import { patientWorkspacePath } from "@/lib/constants/patient-workspace-tabs";
import {
  buildClinicalSummary,
  extractPathologySearchQuery,
} from "@/lib/utils/clinical-assistant";
import type { PathologyDrug, PathologySearchResult } from "@/types/pharmacology";

type Props = Pick<PatientChartViewProps, "chart" | "patient" | "patientId" | "canIssue"> & {
  ehr: PatientEhrWorkspaceData;
};

export function PatientClinicalAssistantPanel({ chart, patient, patientId, ehr, canIssue }: Props) {
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

  return (
    <div className="space-y-4">
      <Card title="Asistente clínico">
        <div className="flex items-start gap-2 rounded-lg border border-violet-100 bg-violet-50/80 px-3 py-2 text-sm text-violet-900">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Sugerencias basadas en el expediente y referencias farmacológicas.{" "}
            <strong>No reemplaza el criterio médico</strong> — verificá siempre antes de prescribir.
          </p>
        </div>
      </Card>

      <Card title="Resumen clínico">
        <ul className="list-inside list-disc space-y-1 text-sm text-slate-700">
          {summaryLines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </Card>

      {chart.alerts.length > 0 ? (
        <Card title="Alertas">
          <ul className="flex flex-wrap gap-2">
            {chart.alerts.map((a) => (
              <li key={`${a.level}:${a.label}`}>
                <Badge variant={a.level === "red" ? "danger" : a.level === "yellow" ? "warning" : "success"}>
                  {a.label}
                </Badge>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {chart.safetyWarnings.length > 0 ? (
        <Card title="Seguridad medicamentosa">
          <ul className="space-y-2 text-sm">
            {chart.safetyWarnings.map((w) => (
              <li key={w} className="flex items-start gap-2 text-amber-900">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                {w}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {chart.reminders.length > 0 ? (
        <Card title="Recordatorios">
          <ul className="list-inside list-disc space-y-1 text-sm text-slate-600">
            {chart.reminders.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card title="CIE-10 sugerido">
        {pathologyQuery ? (
          <p className="mb-2 text-xs text-slate-500">
            Búsqueda a partir de: <span className="font-medium">{pathologyQuery}</span>
          </p>
        ) : (
          <p className="mb-2 text-sm text-slate-500">
            Sin diagnóstico reciente para sugerir CIE-10. Registrá una evolución o diagnóstico.
          </p>
        )}
        {loadingPathologies ? (
          <p className="text-sm text-slate-500">Buscando patologías…</p>
        ) : pathologies.length === 0 && pathologyQuery.length >= 2 ? (
          <p className="text-sm text-slate-500">Sin coincidencias en la guía farmacológica.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {pathologies.slice(0, 6).map((p) => (
              <li key={p.id} className="py-2">
                <button
                  type="button"
                  className="w-full text-left text-sm hover:text-teal-800"
                  onClick={() => setSelectedPathology(p)}
                >
                  <span className="font-medium">{p.name}</span>
                  <span className="ml-2 font-mono text-xs text-slate-500">{p.cie10_code}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {selectedPathology ? (
          <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50 p-3">
            <p className="text-sm font-medium">
              {selectedPathology.name}{" "}
              <span className="font-mono text-teal-700">{selectedPathology.cie10_code}</span>
            </p>
            {drugs.length > 0 ? (
              <ul className="mt-2 space-y-1 text-xs text-slate-600">
                {drugs.map((d) => {
                  const drug = Array.isArray(d.drugs) ? d.drugs[0] : d.drugs;
                  return (
                    <li key={d.id}>
                      {drug?.name ?? "Fármaco"} — {d.dosage_reference ?? "Ver guía"}
                    </li>
                  );
                })}
              </ul>
            ) : null}
            <Link
              href={`/herramientas/farmacologia?pathology=${selectedPathology.id}`}
              className="mt-2 inline-block text-xs text-violet-700 hover:underline"
            >
              Abrir en guía farmacológica →
            </Link>
          </div>
        ) : null}
      </Card>

      <Card title="Acciones rápidas">
        <div className="flex flex-wrap gap-2">
          <Link href={`/historias/nueva?patient=${patientId}`}>
            <Button type="button" size="sm" variant="outline">
              <Stethoscope className="h-4 w-4" />
              Nueva consulta
            </Button>
          </Link>
          <Link href={`/herramientas/farmacologia?patient=${patientId}`}>
            <Button type="button" size="sm" variant="outline">
              <Pill className="h-4 w-4" />
              Farmacología
            </Button>
          </Link>
          {canIssue ? (
            <Link href={`/recetas?patient=${patientId}`}>
              <Button type="button" size="sm" variant="outline">
                <ScrollText className="h-4 w-4" />
                Nueva receta
              </Button>
            </Link>
          ) : null}
          <Link href={patientWorkspacePath(patientId, "timeline")}>
            <Button type="button" size="sm" variant="ghost">
              Ver timeline
            </Button>
          </Link>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Paciente: {patient.last_name}, {patient.first_name}
        </p>
      </Card>
    </div>
  );
}
