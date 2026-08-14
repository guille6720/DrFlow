"use client";

import { X } from "lucide-react";

import { cn } from "@/shared/utils/cn";

import { useClinicalFavoritesOptional } from "@/features/historias/components/historias/clinical-favorites-provider";
import {
  DiagnosisAutocomplete,
  type DiagnosisAutocompleteSelection,
} from "@/features/historias/components/historias/diagnosis-autocomplete";
import { FavoriteStarButton } from "@/features/historias/components/historias/favorite-star-button";
import { diagnosisFavoriteFingerprint } from "@/features/historias/types/clinical-favorites";
import type { ClinicalDiagnosisEntry } from "@/features/historias/utils/clinical-structured-entries";

type Props = {
  diagnoses: ClinicalDiagnosisEntry[];
  onDiagnosesChange: (diagnoses: ClinicalDiagnosisEntry[]) => void;
  className?: string;
  highlighted?: boolean;
  searchInputRef?: React.RefObject<HTMLInputElement | null>;
  label?: string;
  placeholder?: string;
};

function diagnosisKey(entry: ClinicalDiagnosisEntry): string {
  return `${entry.name}|${entry.cie10_code ?? ""}|${entry.clinical_diagnosis_id ?? ""}`.toLowerCase();
}

export function ConsultDiagnosisField({
  diagnoses,
  onDiagnosesChange,
  className,
  highlighted = false,
  searchInputRef,
  label = "Diagnósticos",
  placeholder = "Buscar diagnóstico…",
}: Props) {
  const favorites = useClinicalFavoritesOptional();

  function addDiagnosis(entry: ClinicalDiagnosisEntry) {
    const key = diagnosisKey(entry);
    if (diagnoses.some((d) => diagnosisKey(d) === key)) return;
    onDiagnosesChange([...diagnoses, entry]);
  }

  function handleSelect(selection: DiagnosisAutocompleteSelection) {
    addDiagnosis({
      name: selection.name,
      cie10_code: selection.cie10_code ?? null,
      cie11_code: selection.cie11_code ?? null,
      snomed_code: selection.snomed_code ?? null,
      clinical_diagnosis_id: selection.clinical_diagnosis_id ?? null,
      is_chronic: false,
    });
  }

  function handleRemove(index: number) {
    onDiagnosesChange(diagnoses.filter((_, i) => i !== index));
  }

  return (
    <div className={cn("space-y-2", className)}>
      <DiagnosisAutocomplete
        label={label}
        placeholder={placeholder}
        onSelect={handleSelect}
        highlighted={highlighted}
        allowFreeText
        inputRef={searchInputRef}
        addButtonLabel="+ Agregar diagnóstico"
      />

      {diagnoses.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {diagnoses.map((d, index) => {
            const payload = {
              name: d.name,
              cie10_code: d.cie10_code ?? null,
              cie11_code: d.cie11_code ?? null,
              snomed_code: d.snomed_code ?? null,
              clinical_diagnosis_id: d.clinical_diagnosis_id ?? null,
            };
            const starred = Boolean(
              favorites?.isFavorite("diagnosis", diagnosisFavoriteFingerprint(payload))
            );
            return (
              <li
                key={`${diagnosisKey(d)}-${index}`}
                className="inline-flex max-w-full items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs text-slate-800"
              >
                <span className="truncate font-medium">{d.name}</span>
                {d.cie10_code ? (
                  <span className="shrink-0 text-[10px] uppercase tracking-wide text-sky-700/80">
                    {d.cie10_code}
                  </span>
                ) : null}
                {favorites ? (
                  <FavoriteStarButton
                    active={starred}
                    label={d.name}
                    onToggle={() => void favorites.toggleDiagnosisFavorite(payload)}
                  />
                ) : null}
                <button
                  type="button"
                  aria-label={`Quitar ${d.name}`}
                  onClick={() => handleRemove(index)}
                  className="rounded-full p-0.5 hover:bg-sky-100"
                >
                  <X className="h-3 w-3" />
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
