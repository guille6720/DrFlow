"use client";

import { Clock, Loader2, Star } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

import { cn } from "@/shared/utils/cn";

import { searchClinicalDiagnoses } from "@/features/historias/actions/clinical-diagnoses";
import { useClinicalFavoritesOptional } from "@/features/historias/components/historias/clinical-favorites-provider";
import { ClinicalFavoritesQuickList } from "@/features/historias/components/historias/clinical-favorites-quick-list";
import { ClinicalRecentUsageQuickList } from "@/features/historias/components/historias/clinical-recent-usage-quick-list";
import { FavoriteStarButton } from "@/features/historias/components/historias/favorite-star-button";
import type { ClinicalDiagnosisCatalogHit } from "@/features/historias/types/clinical-diagnosis-catalog";
import {
  type ClinicalFavoriteDiagnosisPayload,
  type ClinicalFavoriteRow,
  diagnosisFavoriteFingerprint,
} from "@/features/historias/types/clinical-favorites";
import type { ClinicalRecentUsageRow } from "@/features/historias/types/clinical-recent-usage";
import {
  buildPrioritizedDiagnosisHits,
  type PrioritizedDiagnosisHit,
} from "@/features/historias/utils/prioritize-clinical-search";

import { Button } from "@/components/ui/button";

export type DiagnosisAutocompleteSelection = {
  name: string;
  clinical_diagnosis_id?: string | null;
  cie10_code?: string | null;
  cie11_code?: string | null;
  snomed_code?: string | null;
  fromCatalog: boolean;
};

type Props = {
  value?: string;
  onValueChange?: (value: string) => void;
  onSelect: (selection: DiagnosisAutocompleteSelection) => void;
  placeholder?: string;
  label?: string;
  className?: string;
  inputClassName?: string;
  highlighted?: boolean;
  allowFreeText?: boolean;
  debounceMs?: number;
  minChars?: number;
  maxResults?: number;
  disabled?: boolean;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  addButtonLabel?: string;
};

function payloadFromFavorite(fav: ClinicalFavoriteRow): ClinicalFavoriteDiagnosisPayload {
  const raw = fav.payload as ClinicalFavoriteDiagnosisPayload;
  return {
    name: raw.name?.trim() || fav.label,
    cie10_code: raw.cie10_code ?? null,
    cie11_code: raw.cie11_code ?? null,
    snomed_code: raw.snomed_code ?? null,
    clinical_diagnosis_id: raw.clinical_diagnosis_id ?? null,
  };
}

function payloadFromRecent(row: ClinicalRecentUsageRow): ClinicalFavoriteDiagnosisPayload {
  const raw = row.payload as ClinicalFavoriteDiagnosisPayload;
  return {
    name: raw.name?.trim() || row.label,
    cie10_code: raw.cie10_code ?? null,
    cie11_code: raw.cie11_code ?? null,
    snomed_code: raw.snomed_code ?? null,
    clinical_diagnosis_id: raw.clinical_diagnosis_id ?? null,
  };
}

function selectableIndex(items: PrioritizedDiagnosisHit[], from: number, direction: 1 | -1): number {
  let i = from;
  while (i >= 0 && i < items.length) {
    if (items[i]?.source !== "separator") return i;
    i += direction;
  }
  return from;
}

export function DiagnosisAutocomplete({
  value,
  onValueChange,
  onSelect,
  placeholder = "Escribí diagnóstico (ej: hiper…)",
  label = "Diagnóstico",
  className,
  inputClassName,
  highlighted = false,
  allowFreeText = true,
  debounceMs = 280,
  minChars = 2,
  maxResults = 10,
  disabled = false,
  inputRef,
  addButtonLabel,
}: Props) {
  const listId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const localInputRef = useRef<HTMLInputElement>(null);
  const favorites = useClinicalFavoritesOptional();
  const [internalQuery, setInternalQuery] = useState("");
  const query = value ?? internalQuery;
  const setQuery = onValueChange ?? setInternalQuery;

  function assignInputRef(node: HTMLInputElement | null) {
    localInputRef.current = node;
    if (inputRef) inputRef.current = node;
  }

  const [results, setResults] = useState<ClinicalDiagnosisCatalogHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);

  const allDiagnosisFavorites = favorites?.byKind("diagnosis") ?? [];
  const allDiagnosisRecent = favorites?.recentByKind("diagnosis") ?? [];

  const listItems = useMemo(
    () =>
      buildPrioritizedDiagnosisHits({
        favorites: favorites?.matchingFavorites("diagnosis", query) ?? [],
        recent: favorites?.matchingRecent("diagnosis", query) ?? [],
        catalog: results,
      }),
    [favorites, query, results]
  );

  const search = useCallback(
    async (q: string) => {
      if (q.trim().length < minChars) {
        setResults([]);
        setError(null);
        return;
      }
      setLoading(true);
      setError(null);
      const res = await searchClinicalDiagnoses(q, maxResults);
      setLoading(false);
      if (res.error) {
        setError(res.error);
        setResults([]);
        return;
      }
      setResults(res.data ?? []);
      setHighlight(0);
    },
    [maxResults, minChars]
  );

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => void search(query), debounceMs);
    return () => window.clearTimeout(timer);
  }, [query, open, search, debounceMs]);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function commitSelection(selection: DiagnosisAutocompleteSelection) {
    const payload: ClinicalFavoriteDiagnosisPayload = {
      name: selection.name,
      cie10_code: selection.cie10_code ?? null,
      cie11_code: selection.cie11_code ?? null,
      snomed_code: selection.snomed_code ?? null,
      clinical_diagnosis_id: selection.clinical_diagnosis_id ?? null,
    };
    void favorites?.rememberDiagnosisUsage(payload);
    onSelect(selection);
    setQuery("");
    setResults([]);
    setOpen(false);
  }

  function commitPayload(payload: ClinicalFavoriteDiagnosisPayload) {
    commitSelection({
      name: payload.name,
      clinical_diagnosis_id: payload.clinical_diagnosis_id ?? null,
      cie10_code: payload.cie10_code ?? null,
      cie11_code: payload.cie11_code ?? null,
      snomed_code: payload.snomed_code ?? null,
      fromCatalog: Boolean(payload.clinical_diagnosis_id),
    });
  }

  function commitFreeText() {
    if (!allowFreeText) return;
    const name = query.trim();
    if (!name) return;
    commitSelection({ name, fromCatalog: false });
  }

  function activateHighlighted() {
    const item = listItems[highlight];
    if (!item || item.source === "separator") {
      commitFreeText();
      return;
    }
    commitPayload(item.payload);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" && listItems.length > 0) {
      event.preventDefault();
      setHighlight((h) => selectableIndex(listItems, Math.min(h + 1, listItems.length - 1), 1));
      return;
    }
    if (event.key === "ArrowUp" && listItems.length > 0) {
      event.preventDefault();
      setHighlight((h) => selectableIndex(listItems, Math.max(h - 1, 0), -1));
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      activateHighlighted();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className={cn("relative space-y-1.5", className)}>
      {label ? (
        <label htmlFor={listId} className="mb-1.5 block text-sm font-medium drflow-ehr-label">
          {label}
        </label>
      ) : null}
      <input
        ref={assignInputRef}
        id={listId}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        aria-controls={`${listId}-listbox`}
        placeholder={placeholder}
        value={query}
        disabled={disabled}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        className={cn(
          "drflow-clinical-combobox-input w-full rounded-md py-2.5 px-3 focus:ring-2 focus:ring-sky-400/50",
          highlighted && "ring-2 ring-sky-400/50",
          inputClassName
        )}
      />

      {allowFreeText && addButtonLabel ? (
        <div className="flex justify-end">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={commitFreeText}
            disabled={disabled || !query.trim()}
          >
            {addButtonLabel}
          </Button>
        </div>
      ) : null}

      {favorites && open ? (
        <>
          <ClinicalFavoritesQuickList
            title="Mis diagnósticos frecuentes"
            favorites={allDiagnosisFavorites}
            onPick={(fav) => commitPayload(payloadFromFavorite(fav))}
            onToggleFavorite={(fav) => {
              void favorites.toggleDiagnosisFavorite(payloadFromFavorite(fav));
            }}
          />
          <ClinicalRecentUsageQuickList
            items={allDiagnosisRecent.filter(
              (r) =>
                !favorites.isFavorite("diagnosis", diagnosisFavoriteFingerprint(payloadFromRecent(r)))
            )}
            onPick={(row) => commitPayload(payloadFromRecent(row))}
          />
        </>
      ) : null}

      {loading ? (
        <p className="inline-flex items-center gap-1 text-xs text-slate-500">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Buscando…
        </p>
      ) : null}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}

      {open && listItems.length > 0 ? (
        <ul
          id={`${listId}-listbox`}
          role="listbox"
          className="drflow-clinical-combobox-list absolute z-[100] mt-1 max-h-72 w-full overflow-y-auto rounded-md py-1 shadow-lg"
        >
          {listItems.map((entry, index) => {
            if (entry.source === "separator") {
              return (
                <li
                  key={entry.key}
                  role="separator"
                  className="my-1 border-t border-slate-200"
                  aria-hidden
                />
              );
            }

            const payload = entry.payload;
            const starred = Boolean(
              favorites?.isFavorite("diagnosis", diagnosisFavoriteFingerprint(payload))
            );
            const isFavoriteRow = entry.source === "favorite";
            const isRecentRow = entry.source === "recent";

            return (
              <li key={entry.key} role="presentation">
                <div
                  className={cn(
                    "flex w-full items-start gap-2 px-3 py-2 text-left transition-colors",
                    index === highlight && (isFavoriteRow || isRecentRow ? "bg-amber-500/10" : "bg-sky-500/10")
                  )}
                  onMouseEnter={() => setHighlight(index)}
                >
                  <button
                    type="button"
                    role="option"
                    aria-selected={index === highlight}
                    onClick={() => commitPayload(payload)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="inline-flex items-center gap-1 text-sm font-semibold text-slate-900">
                      {isFavoriteRow ? (
                        <Star className="h-3 w-3 fill-current text-amber-500" aria-hidden />
                      ) : null}
                      {isRecentRow ? <Clock className="h-3 w-3 text-slate-500" aria-hidden /> : null}
                      {payload.name}
                    </p>
                    {isFavoriteRow ? (
                      <p className="mt-0.5 text-xs text-amber-800/80">Favorito</p>
                    ) : null}
                    {isRecentRow ? (
                      <p className="mt-0.5 text-xs text-slate-500">Usado recientemente</p>
                    ) : null}
                    {entry.source === "catalog" ? (
                      <p className="mt-0.5 text-xs text-slate-500">
                        {payload.cie10_code ? `CIE-10: ${payload.cie10_code}` : "Sin CIE-10"}
                        {payload.snomed_code ? ` · SNOMED: ${payload.snomed_code}` : ""}
                      </p>
                    ) : null}
                  </button>
                  {favorites ? (
                    <FavoriteStarButton
                      active={starred}
                      label={payload.name}
                      onToggle={() => void favorites.toggleDiagnosisFavorite(payload)}
                    />
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}

      {open && !loading && query.trim().length >= minChars && listItems.length === 0 && allowFreeText ? (
        <p className="drflow-clinical-combobox-hint text-xs">
          Sin coincidencias. Enter agrega “{query.trim()}” como diagnóstico libre.
        </p>
      ) : (
        <p className="drflow-clinical-combobox-hint text-xs">
          Prioridad: ⭐ favoritos · 🕘 recientes · catálogo
        </p>
      )}
    </div>
  );
}
