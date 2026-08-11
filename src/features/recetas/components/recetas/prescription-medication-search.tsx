"use client";

import { Loader2, Search } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

import { cn } from "@/shared/utils/cn";

import { pathologyDrugToPrescription } from "@/features/recetas/components/recetas/pathology-drug-to-prescription";
import {
  formatVademecumPrescriptionLabel,
  formatVademecumPrescriptionSubtitle,
  vademecumToPrescription,
} from "@/features/recetas/components/recetas/vademecum-to-prescription";
import { usePrescriptionDiagnosisHints } from "@/features/recetas/hooks/use-prescription-diagnosis-hints";
import { medicationCatalogSearchLabel } from "@/features/recetas/utils/medication-catalog-utils";

import { searchMedicationCatalog } from "@/lib/actions/pharmacology";
import type { MedicationCatalogResult, PathologyDrug } from "@/types/pharmacology";
import { TREATMENT_LINE_LABELS } from "@/types/pharmacology";
import type { PrescriptionMedication } from "@/types/prescription";

const MIN_CATALOG_QUERY = 2;

type Props = {
  onAdd: (medication: PrescriptionMedication) => void;
  existingGenericNames?: string[];
  diagnosisText?: string;
  cie10?: string;
  className?: string;
};

type SearchListItem =
  | { kind: "pathology"; key: string; drug: PathologyDrug }
  | { kind: "catalog"; key: string; item: MedicationCatalogResult };

function resolvePathologyDrug(pd: PathologyDrug) {
  return Array.isArray(pd.drugs) ? pd.drugs[0] : pd.drugs;
}

/** Búsqueda vademécum + sugerencias según diagnóstico al enfocar o con pocas letras. */
export function PrescriptionMedicationSearch({
  onAdd,
  existingGenericNames = [],
  diagnosisText = "",
  cie10 = "",
  className,
}: Props) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MedicationCatalogResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);

  const existing = new Set(existingGenericNames.map((name) => name.toLowerCase()));
  const trimmedQuery = query.trim();
  const useCatalogSearch = trimmedQuery.length >= MIN_CATALOG_QUERY;

  const { pathologyName, drugs, loading: hintsLoading, hasHints } = usePrescriptionDiagnosisHints({
    diagnosisText,
    cie10,
    enabled: Boolean(diagnosisText.trim() || cie10.trim()),
  });

  const search = useCallback(async (q: string) => {
    if (q.trim().length < MIN_CATALOG_QUERY) {
      setResults([]);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    const res = await searchMedicationCatalog(q);
    setLoading(false);
    if (res.error) {
      setError(res.error);
      setResults([]);
    } else {
      setResults(res.data ?? []);
      setHighlight(0);
    }
  }, []);

  useEffect(() => {
    if (!open || !useCatalogSearch) return;
    const t = setTimeout(() => void search(query), 280);
    return () => clearTimeout(t);
  }, [query, open, search, useCatalogSearch]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const listItems = useMemo<SearchListItem[]>(() => {
    if (useCatalogSearch) {
      return results.map((item) => ({ kind: "catalog", key: item.id, item }));
    }
    if (hasHints) {
      return drugs.map((drug) => ({ kind: "pathology", key: drug.id, drug }));
    }
    return [];
  }, [drugs, hasHints, results, useCatalogSearch]);

  const activeHighlight =
    listItems.length === 0 ? 0 : Math.min(highlight, listItems.length - 1);

  function handleSelectPathologyDrug(drug: PathologyDrug) {
    const med = pathologyDrugToPrescription(drug);
    if (!med) return;
    onAdd(med);
    setQuery("");
    setResults([]);
    setOpen(false);
    inputRef.current?.focus();
  }

  function handleSelectCatalog(item: MedicationCatalogResult) {
    onAdd(vademecumToPrescription(item));
    setQuery("");
    setResults([]);
    setOpen(false);
    inputRef.current?.focus();
  }

  function handleSelectListItem(item: SearchListItem) {
    if (item.kind === "pathology") {
      handleSelectPathologyDrug(item.drug);
      return;
    }
    handleSelectCatalog(item.item);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open || listItems.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, listItems.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = listItems[activeHighlight];
      if (item) handleSelectListItem(item);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const showDropdown = open && listItems.length > 0;
  const showHintsEmpty =
    open &&
    !useCatalogSearch &&
    !hintsLoading &&
    !hasHints &&
    Boolean(diagnosisText.trim() || cie10.trim());
  const showCatalogEmpty =
    open && useCatalogSearch && !loading && results.length === 0 && !error;
  const isBusy = useCatalogSearch ? loading : hintsLoading;

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <label htmlFor={listId} className="mb-1.5 block text-sm font-medium text-slate-700">
        Buscar tratamiento
      </label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          ref={inputRef}
          id={listId}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          aria-controls={`${listId}-listbox`}
          placeholder={
            hasHints
              ? "Elegí una sugerencia o escribí para buscar (ej: losartán)…"
              : "Ej: rosu, losartán, enalapril…"
          }
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setHighlight(0);
          }}
          onFocus={() => {
            setOpen(true);
            setHighlight(0);
          }}
          onKeyDown={handleKeyDown}
          className="drflow-clinical-combobox-input rounded-lg py-3 pl-10 pr-10 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
        />
        {isBusy ? (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-teal-600" />
        ) : null}
      </div>

      {error ? (
        <p className="mt-2 text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      {open && !useCatalogSearch && hintsLoading ? (
        <p className="mt-2 text-sm text-slate-500">Buscando opciones según el diagnóstico…</p>
      ) : null}

      {showHintsEmpty ? (
        <p className="mt-2 text-sm text-slate-500">
          Sin sugerencias para este diagnóstico. Escribí al menos 2 letras para buscar en el
          vademécum.
        </p>
      ) : null}

      {showCatalogEmpty ? (
        <p className="mt-2 text-sm text-slate-500">
          Sin alternativas para &quot;{query}&quot;. Probá con menos letras o revisá la ortografía.
        </p>
      ) : null}

      {showDropdown ? (
        <ul
          id={`${listId}-listbox`}
          role="listbox"
          className="drflow-clinical-combobox-list absolute z-[100] mt-1 max-h-80 w-full overflow-y-auto rounded-lg py-1 shadow-xl ring-1 ring-black/5"
        >
          {!useCatalogSearch && pathologyName ? (
            <li
              role="presentation"
              className="border-b border-slate-100 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-teal-800"
            >
              Sugeridos para {pathologyName}
            </li>
          ) : null}
          {listItems.map((entry, i) => {
            if (entry.kind === "pathology") {
              const drugInfo = resolvePathologyDrug(entry.drug);
              if (!drugInfo) return null;
              const genericKey = drugInfo.active_ingredient.trim().toLowerCase();
              const alreadyAdded = existing.has(genericKey);
              const lineLabel =
                TREATMENT_LINE_LABELS[entry.drug.treatment_line] ??
                `Línea ${entry.drug.treatment_line}`;

              return (
                <li key={entry.key} role="presentation">
                  <button
                    type="button"
                    role="option"
                    aria-selected={i === activeHighlight}
                    onMouseEnter={() => setHighlight(i)}
                    onClick={() => handleSelectPathologyDrug(entry.drug)}
                    className={cn(
                      "w-full px-4 py-2.5 text-left transition-colors",
                      i === activeHighlight ? "bg-teal-50" : "hover:bg-slate-50",
                      alreadyAdded && "drflow-clinical-combobox-option-disabled"
                    )}
                  >
                    <p className="text-sm font-semibold uppercase tracking-wide text-slate-900">
                      {drugInfo.active_ingredient}
                    </p>
                    <p className="text-xs text-slate-600">
                      {drugInfo.name}
                      {drugInfo.presentation ? ` · ${drugInfo.presentation}` : ""}
                      {` · ${lineLabel}`}
                    </p>
                    {entry.drug.dosage_reference ? (
                      <p className="text-xs text-blue-700">{entry.drug.dosage_reference}</p>
                    ) : null}
                    {alreadyAdded ? (
                      <p className="drflow-clinical-combobox-option-added mt-0.5">Ya en la receta</p>
                    ) : null}
                  </button>
                </li>
              );
            }

            const item = entry.item;
            const genericKey = item.active_ingredient.trim().toLowerCase();
            const alreadyAdded = existing.has(genericKey);
            return (
              <li key={entry.key} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={i === activeHighlight}
                  onMouseEnter={() => setHighlight(i)}
                  onClick={() => handleSelectCatalog(item)}
                  className={cn(
                    "w-full px-4 py-2.5 text-left transition-colors",
                    i === activeHighlight ? "bg-teal-50" : "hover:bg-slate-50",
                    alreadyAdded && "drflow-clinical-combobox-option-disabled"
                  )}
                >
                  <p className="text-sm font-semibold uppercase tracking-wide text-slate-900">
                    {formatVademecumPrescriptionLabel(item)}
                  </p>
                  <p className="text-xs text-slate-600">{formatVademecumPrescriptionSubtitle(item)}</p>
                  {alreadyAdded ? (
                    <p className="drflow-clinical-combobox-option-added mt-0.5">Ya en la receta</p>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      <p className="drflow-clinical-combobox-hint mt-2">
        {hasHints
          ? `Opciones según el diagnóstico, o ${medicationCatalogSearchLabel().toLowerCase()} escribiendo 2 letras.`
          : `${medicationCatalogSearchLabel()}. Escribí al menos 2 letras y elegí una alternativa.`}
      </p>
    </div>
  );
}
