"use client";

import { Activity, Loader2, Pill, Stethoscope } from "lucide-react";

import { cn } from "@/shared/utils/cn";

import { PathologyMatchList } from "@/features/pharmacology/components/pharmacology/pathology-match-list";
import { PathologyTypeahead } from "@/features/pharmacology/components/pharmacology/pathology-typeahead";
import { SymptomTypeahead } from "@/features/pharmacology/components/pharmacology/symptom-typeahead";
import { PrescriptionDrugSuggestions } from "@/features/recetas/components/recetas/prescription-drug-suggestions";
import { usePrescriptionPharmacologyPicker } from "@/features/recetas/hooks/use-prescription-pharmacology-picker";

import type { PathologySearchResult } from "@/types/pharmacology";
import type { PrescriptionMedication } from "@/types/prescription";

export { pathologyDrugToPrescription } from "@/features/recetas/components/recetas/pathology-drug-to-prescription";

interface Props {
  onPathologySelect: (pathology: PathologySearchResult) => void;
  onAddMedications: (medications: PrescriptionMedication[]) => void;
  existingGenericNames: string[];
}

export function PrescriptionPharmacologyPicker({
  onPathologySelect,
  onAddMedications,
  existingGenericNames,
}: Props) {
  const picker = usePrescriptionPharmacologyPicker({ onPathologySelect });

  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Pill className="h-4 w-4 text-blue-700" />
        <h4 className="text-sm font-semibold text-blue-900">Guía farmacológica</h4>
      </div>
      <p className="mb-3 text-xs text-blue-800">
        Buscá por patología, CIE-10 o síntomas para completar diagnóstico y agregar medicamentos.
      </p>

      <div className="mb-3 flex gap-1 rounded-lg border border-blue-200 bg-white p-1">
        <button
          type="button"
          onClick={() => picker.switchMode("pathology")}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium transition-colors",
            picker.mode === "pathology"
              ? "bg-blue-600 text-white"
              : "text-blue-800 hover:bg-blue-50"
          )}
        >
          <Stethoscope className="h-3.5 w-3.5" />
          Por patología
        </button>
        <button
          type="button"
          onClick={() => picker.switchMode("symptoms")}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium transition-colors",
            picker.mode === "symptoms"
              ? "bg-blue-600 text-white"
              : "text-blue-800 hover:bg-blue-50"
          )}
        >
          <Activity className="h-3.5 w-3.5" />
          Por síntomas
        </button>
      </div>

      {picker.mode === "pathology" ? (
        <PathologyTypeahead
          selected={picker.selected}
          onSelect={picker.loadDrugs}
          onClear={picker.clearPathologySelection}
        />
      ) : (
        <div className="space-y-3">
          <SymptomTypeahead selected={picker.symptoms} onChange={picker.handleSymptomsChange} />
          <PathologyMatchList
            items={picker.pathologyMatches}
            loading={picker.matchesLoading}
            error={picker.matchesError}
            symptomCount={picker.symptoms.length}
            onSelect={picker.loadDrugs}
            selectedId={picker.selected?.id}
          />
        </div>
      )}

      {picker.loading && (
        <div className="mt-3 flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Cargando fármacos…
        </div>
      )}

      {picker.error && <p className="mt-3 text-sm text-red-600">{picker.error}</p>}

      {picker.selected && !picker.loading && (
        <PrescriptionDrugSuggestions
          pathologyName={picker.selected.name}
          drugs={picker.drugs}
          existingGenericNames={existingGenericNames}
          onAddMedications={onAddMedications}
        />
      )}
    </div>
  );
}
