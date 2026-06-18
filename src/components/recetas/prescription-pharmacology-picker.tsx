"use client";

import { useState } from "react";
import { PathologyTypeahead } from "@/components/pharmacology/pathology-typeahead";
import { SymptomTypeahead } from "@/components/pharmacology/symptom-typeahead";
import { PathologyMatchList } from "@/components/pharmacology/pathology-match-list";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getDrugsByPathology, getPathologiesBySymptoms } from "@/lib/actions/pharmacology";
import { cn } from "@/lib/utils/cn";
import { TREATMENT_LINE_LABELS } from "@/types/pharmacology";
import type {
  PathologyBySymptomResult,
  PathologyDrug,
  PathologySearchResult,
  PharmacologySearchMode,
  SymptomSearchResult,
} from "@/types/pharmacology";
import type { PrescriptionMedication } from "@/types/prescription";
import { Activity, Loader2, Pill, Plus, Stethoscope } from "lucide-react";

function resolveDrug(pd: PathologyDrug) {
  return Array.isArray(pd.drugs) ? pd.drugs[0] : pd.drugs;
}

export function pathologyDrugToPrescription(pd: PathologyDrug): PrescriptionMedication | null {
  const drug = resolveDrug(pd);
  if (!drug) return null;
  return {
    generic_name: drug.active_ingredient || drug.name,
    brand_name: drug.name !== drug.active_ingredient ? drug.name : "",
    presentation: drug.presentation ?? "",
    concentration: "",
    quantity: 1,
    posology: pd.dosage_reference ?? "",
    route: drug.route ?? "oral",
  };
}

interface Props {
  onPathologySelect: (pathology: PathologySearchResult) => void;
  onAddMedications: (medications: PrescriptionMedication[]) => void;
  existingGenericNames: string[];
}

function DrugSuggestions({
  pathologyName,
  drugs,
  existingGenericNames,
  onAddMedications,
}: {
  pathologyName: string;
  drugs: PathologyDrug[];
  existingGenericNames: string[];
  onAddMedications: (medications: PrescriptionMedication[]) => void;
}) {
  function addDrug(pd: PathologyDrug) {
    const med = pathologyDrugToPrescription(pd);
    if (!med) return;
    if (existingGenericNames.some((n) => n.toLowerCase() === med.generic_name.toLowerCase())) {
      return;
    }
    onAddMedications([med]);
  }

  function addFirstLine() {
    const firstLine = drugs.filter((d) => d.treatment_line === 1);
    const meds = firstLine
      .map(pathologyDrugToPrescription)
      .filter((m): m is PrescriptionMedication => m !== null)
      .filter(
        (m) => !existingGenericNames.some((n) => n.toLowerCase() === m.generic_name.toLowerCase())
      );
    if (meds.length > 0) onAddMedications(meds);
  }

  const grouped = drugs.reduce<Map<number, PathologyDrug[]>>((acc, pd) => {
    const line = pd.treatment_line;
    if (!acc.has(line)) acc.set(line, []);
    acc.get(line)!.push(pd);
    return acc;
  }, new Map());

  if (drugs.length === 0) {
    return (
      <p className="mt-3 text-sm text-slate-500">Sin fármacos de referencia para esta patología.</p>
    );
  }

  return (
    <div className="mt-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium text-slate-600">Fármacos sugeridos para {pathologyName}</p>
        <Button type="button" size="sm" variant="outline" onClick={addFirstLine}>
          <Plus className="h-3.5 w-3.5" />
          Agregar 1ª línea
        </Button>
      </div>

      {Array.from(grouped.entries())
        .sort(([a], [b]) => a - b)
        .map(([line, lineDrugs]) => (
          <div key={line} className="rounded-lg border border-white bg-white p-3">
            <p className="mb-2 text-xs font-semibold text-slate-500">
              {TREATMENT_LINE_LABELS[line] ?? `Línea ${line}`}
            </p>
            <ul className="space-y-2">
              {lineDrugs.map((pd) => {
                const drug = resolveDrug(pd);
                if (!drug) return null;
                const med = pathologyDrugToPrescription(pd);
                    const alreadyAdded = Boolean(
                      med &&
                        existingGenericNames.some(
                          (n) => n.toLowerCase() === med.generic_name.toLowerCase()
                        )
                    );
                return (
                  <li
                    key={pd.id}
                    className="flex flex-wrap items-start justify-between gap-2 rounded-md bg-slate-50 px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-900">{drug.active_ingredient}</p>
                      <p className="text-xs text-slate-600">
                        {drug.name}
                        {drug.presentation ? ` · ${drug.presentation}` : ""}
                      </p>
                      {pd.dosage_reference && (
                        <p className="text-xs text-teal-700">{pd.dosage_reference}</p>
                      )}
                      <Badge variant="teal" className="mt-1 font-mono text-[10px]">
                        {drug.atc_code}
                      </Badge>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={alreadyAdded}
                      onClick={() => addDrug(pd)}
                    >
                      {alreadyAdded ? "Agregado" : "Agregar"}
                    </Button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
    </div>
  );
}

export function PrescriptionPharmacologyPicker({
  onPathologySelect,
  onAddMedications,
  existingGenericNames,
}: Props) {
  const [mode, setMode] = useState<PharmacologySearchMode>("pathology");
  const [selected, setSelected] = useState<PathologySearchResult | null>(null);
  const [symptoms, setSymptoms] = useState<SymptomSearchResult[]>([]);
  const [pathologyMatches, setPathologyMatches] = useState<PathologyBySymptomResult[]>([]);
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [matchesError, setMatchesError] = useState<string | null>(null);
  const [drugs, setDrugs] = useState<PathologyDrug[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function clearPathologySelection() {
    setSelected(null);
    setDrugs([]);
    setError(null);
    setLoading(false);
  }

  function loadDrugs(pathology: PathologySearchResult) {
    setSelected(pathology);
    onPathologySelect(pathology);
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
    clearPathologySelection();
    fetchPathologyMatches(next);
  }

  function switchMode(next: PharmacologySearchMode) {
    setMode(next);
    clearPathologySelection();
    setSymptoms([]);
    setPathologyMatches([]);
    setMatchesError(null);
    setMatchesLoading(false);
  }

  return (
    <div className="rounded-xl border border-teal-200 bg-teal-50/40 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Pill className="h-4 w-4 text-teal-700" />
        <h4 className="text-sm font-semibold text-teal-900">Guía farmacológica</h4>
      </div>
      <p className="mb-3 text-xs text-teal-800">
        Buscá por patología, CIE-10 o síntomas para completar diagnóstico y agregar medicamentos.
      </p>

      <div className="mb-3 flex gap-1 rounded-lg border border-teal-200 bg-white p-1">
        <button
          type="button"
          onClick={() => switchMode("pathology")}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium transition-colors",
            mode === "pathology"
              ? "bg-teal-600 text-white"
              : "text-teal-800 hover:bg-teal-50"
          )}
        >
          <Stethoscope className="h-3.5 w-3.5" />
          Por patología
        </button>
        <button
          type="button"
          onClick={() => switchMode("symptoms")}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium transition-colors",
            mode === "symptoms"
              ? "bg-teal-600 text-white"
              : "text-teal-800 hover:bg-teal-50"
          )}
        >
          <Activity className="h-3.5 w-3.5" />
          Por síntomas
        </button>
      </div>

      {mode === "pathology" ? (
        <PathologyTypeahead
          selected={selected}
          onSelect={loadDrugs}
          onClear={clearPathologySelection}
        />
      ) : (
        <div className="space-y-3">
          <SymptomTypeahead selected={symptoms} onChange={handleSymptomsChange} />
          <PathologyMatchList
            items={pathologyMatches}
            loading={matchesLoading}
            error={matchesError}
            symptomCount={symptoms.length}
            onSelect={loadDrugs}
            selectedId={selected?.id}
          />
        </div>
      )}

      {loading && (
        <div className="mt-3 flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Cargando fármacos…
        </div>
      )}

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {selected && !loading && (
        <DrugSuggestions
          pathologyName={selected.name}
          drugs={drugs}
          existingGenericNames={existingGenericNames}
          onAddMedications={onAddMedications}
        />
      )}
    </div>
  );
}
