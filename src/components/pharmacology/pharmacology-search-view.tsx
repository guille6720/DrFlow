"use client";

import { useState } from "react";
import { Header } from "@/components/layout/header";
import { Card } from "@/components/ui/card";
import { PathologyTypeahead } from "@/components/pharmacology/pathology-typeahead";
import { SymptomTypeahead } from "@/components/pharmacology/symptom-typeahead";
import { PathologyMatchList } from "@/components/pharmacology/pathology-match-list";
import { DrugTreatmentList } from "@/components/pharmacology/drug-treatment-list";
import {
  getDrugsByPathology,
  getPathologiesBySymptoms,
} from "@/lib/actions/pharmacology";
import type {
  PathologyBySymptomResult,
  PathologyDrug,
  PathologySearchResult,
  PharmacologySearchMode,
  SymptomSearchResult,
} from "@/types/pharmacology";
import type { Clinic, UserRole } from "@/types/database";
import { cn } from "@/lib/utils/cn";
import { Activity, Stethoscope } from "lucide-react";

interface Props {
  clinics: { clinic_id: string; clinic?: Clinic }[];
  clinicId: string | null;
  role: UserRole | null;
  userName?: string;
  initialMode?: PharmacologySearchMode;
}

export function PharmacologySearchView({
  clinics,
  clinicId,
  role,
  userName,
  initialMode = "pathology",
}: Props) {
  const [mode, setMode] = useState<PharmacologySearchMode>(initialMode);
  const [selected, setSelected] = useState<PathologySearchResult | null>(null);
  const [symptoms, setSymptoms] = useState<SymptomSearchResult[]>([]);
  const [pathologyMatches, setPathologyMatches] = useState<PathologyBySymptomResult[]>([]);
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [matchesError, setMatchesError] = useState<string | null>(null);
  const [drugs, setDrugs] = useState<PathologyDrug[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function fetchPathologyMatches(nextSymptoms: SymptomSearchResult[]) {
    if (nextSymptoms.length === 0) {
      setPathologyMatches([]);
      setMatchesError(null);
      setMatchesLoading(false);
      return;
    }

    setMatchesLoading(true);
    setMatchesError(null);

    getPathologiesBySymptoms(nextSymptoms.map((s) => s.id)).then((res) => {
      setMatchesLoading(false);
      if (res.error) {
        setMatchesError(res.error);
        setPathologyMatches([]);
      } else {
        setPathologyMatches(res.data ?? []);
      }
    });
  }

  function handleSymptomsChange(next: SymptomSearchResult[]) {
    setSymptoms(next);
    handleClearPathology();
    fetchPathologyMatches(next);
  }

  function loadDrugs(pathology: PathologySearchResult) {
    setSelected(pathology);
    setLoading(true);
    setError(null);

    getDrugsByPathology(pathology.id).then((res) => {
      setLoading(false);
      if (res.error) {
        setError(res.error);
        setDrugs([]);
      } else {
        setDrugs(res.data ?? []);
      }
    });
  }

  function handlePathologySelect(pathology: PathologySearchResult) {
    loadDrugs(pathology);
  }

  function handleSymptomPathologySelect(pathology: PathologyBySymptomResult) {
    loadDrugs(pathology);
  }

  function handleClearPathology() {
    setSelected(null);
    setDrugs([]);
    setError(null);
    setLoading(false);
  }

  function switchMode(next: PharmacologySearchMode) {
    setMode(next);
    handleClearPathology();
    setSymptoms([]);
    setPathologyMatches([]);
    setMatchesError(null);
    setMatchesLoading(false);
  }

  return (
    <>
      <Header
        title="Guía farmacológica"
        subtitle="Patología CIE-10 o síntomas → fármacos ATC de referencia"
        clinics={clinics}
        activeClinicId={clinicId}
        role={role}
        userName={userName}
      />

      <div className="space-y-6 p-4 sm:p-6">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => switchMode("pathology")}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              mode === "pathology"
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
            )}
          >
            <Stethoscope className="h-4 w-4" />
            Por patología / CIE-10
          </button>
          <button
            type="button"
            onClick={() => switchMode("symptoms")}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              mode === "symptoms"
                ? "bg-violet-600 text-white shadow-sm"
                : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
            )}
          >
            <Activity className="h-4 w-4" />
            Por síntomas
          </button>
        </div>

        {mode === "pathology" ? (
          <Card className="border-blue-100">
            <PathologyTypeahead
              selected={selected}
              onSelect={handlePathologySelect}
              onClear={handleClearPathology}
            />
            <p className="mt-3 text-xs text-slate-500">
              Tip: buscá por código (<span className="font-mono">I10</span>,{" "}
              <span className="font-mono">E11</span>) o nombre de enfermedad.
            </p>
          </Card>
        ) : (
          <div className="space-y-4">
            <Card className="border-violet-100">
              <SymptomTypeahead selected={symptoms} onChange={handleSymptomsChange} />
              <p className="mt-3 text-xs text-slate-500">
                Tip: podés usar frases comunes como &quot;dolor en las piernas&quot;,
                &quot;dolor de garganta&quot; o &quot;falta de aire&quot;.
              </p>
            </Card>

            <PathologyMatchList
              items={pathologyMatches}
              loading={matchesLoading}
              error={matchesError}
              symptomCount={symptoms.length}
              onSelect={handleSymptomPathologySelect}
              selectedId={selected?.id}
            />
          </div>
        )}

        <DrugTreatmentList
          items={selected ? drugs : []}
          loading={selected ? loading : false}
          error={selected ? error : null}
          pathologyName={selected?.name}
          cie10Code={selected?.cie10_code}
          searchMode={mode}
        />
      </div>
    </>
  );
}
