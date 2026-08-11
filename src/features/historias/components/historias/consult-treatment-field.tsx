"use client";

import { Loader2, Search, X } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";

import { cn } from "@/shared/utils/cn";

import {
  formatVademecumPrescriptionLabel,
  formatVademecumPrescriptionSubtitle,
  vademecumToPrescription,
} from "@/features/recetas/components/recetas/vademecum-to-prescription";
import { formatPrescriptionMedicationLabel } from "@/features/recetas/utils/format-prescription-medication-label";

import { Textarea } from "@/components/ui/textarea";
import { searchPamiVademecum } from "@/lib/actions/pharmacology";
import type { PamiVademecumResult } from "@/types/pharmacology";
import type { PrescriptionMedication } from "@/types/prescription";

const MIN_QUERY_LENGTH = 2;

type Props = {
  medications: PrescriptionMedication[];
  onMedicationsChange: (medications: PrescriptionMedication[]) => void;
  indications: string;
  onIndicationsChange: (value: string) => void;
  searchInputRef?: React.RefObject<HTMLInputElement | null>;
  className?: string;
  highlighted?: boolean;
};

export function ConsultTreatmentField({
  medications,
  onMedicationsChange,
  indications,
  onIndicationsChange,
  searchInputRef,
  className,
  highlighted = false,
}: Props) {
  const listId = useId();
  const internalSearchRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PamiVademecumResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);

  const existing = new Set(medications.map((med) => med.generic_name.trim().toLowerCase()));

  const search = useCallback(async (q: string) => {
    if (q.trim().length < MIN_QUERY_LENGTH) {
      setResults([]);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    const res = await searchPamiVademecum(q);
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
    if (!open) return;
    const timer = window.setTimeout(() => void search(query), 280);
    return () => window.clearTimeout(timer);
  }, [query, open, search]);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function assignSearchRef(node: HTMLInputElement | null) {
    internalSearchRef.current = node;
    if (searchInputRef) searchInputRef.current = node;
  }

  function handleSelect(item: PamiVademecumResult) {
    const med = vademecumToPrescription(item);
    const key = med.generic_name.trim().toLowerCase();
    if (!existing.has(key)) {
      onMedicationsChange([...medications, med]);
    }
    setQuery("");
    setResults([]);
    setOpen(false);
    internalSearchRef.current?.focus();
  }

  function handleRemove(index: number) {
    onMedicationsChange(medications.filter((_, i) => i !== index));
  }

  function handleSearchKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || results.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlight((h) => Math.min(h + 1, results.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const item = results[highlight];
      if (item) handleSelect(item);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div ref={containerRef} className="relative">
        <label htmlFor={listId} className="mb-1.5 block text-sm font-medium drflow-ehr-label">
          Tratamiento
        </label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 opacity-60" />
          <input
            ref={assignSearchRef}
            id={listId}
            type="text"
            role="combobox"
            aria-expanded={open}
            aria-autocomplete="list"
            aria-controls={`${listId}-listbox`}
            placeholder="Buscar medicamento (ej: rosu, losartán, ibu…)"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={handleSearchKeyDown}
            className={cn(
              "w-full rounded-md border border-[var(--border)] bg-[color-mix(in_srgb,var(--ehr-panel)_96%,white_4%)] py-2.5 pl-10 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/60",
              highlighted && "ring-2 ring-teal-400/60"
            )}
          />
          {loading ? (
            <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-teal-600" />
          ) : null}
        </div>

        {error ? (
          <p className="mt-1.5 text-xs text-red-600" role="alert">
            {error}
          </p>
        ) : null}

        {open && query.length >= MIN_QUERY_LENGTH && !loading && results.length === 0 && !error ? (
          <p className="mt-1.5 text-xs drflow-ehr-muted">Sin resultados para &quot;{query}&quot;</p>
        ) : null}

        {open && results.length > 0 ? (
          <ul
            id={`${listId}-listbox`}
            role="listbox"
            className="absolute z-[100] mt-1 max-h-72 w-full overflow-y-auto rounded-md border border-[var(--border)] bg-[var(--ehr-panel)] py-1 shadow-lg"
          >
            {results.map((item, index) => {
              const genericKey = item.active_ingredient.trim().toLowerCase();
              const alreadyAdded = existing.has(genericKey);
              return (
                <li key={item.id} role="presentation">
                  <button
                    type="button"
                    role="option"
                    aria-selected={index === highlight}
                    onMouseEnter={() => setHighlight(index)}
                    onClick={() => handleSelect(item)}
                    className={cn(
                      "w-full px-3 py-2 text-left transition-colors",
                      index === highlight && "bg-teal-500/10",
                      alreadyAdded && "opacity-70"
                    )}
                  >
                    <p className="text-sm font-semibold uppercase tracking-wide">
                      {formatVademecumPrescriptionLabel(item)}
                    </p>
                    <p className="text-xs drflow-ehr-muted">
                      {formatVademecumPrescriptionSubtitle(item)}
                    </p>
                    {alreadyAdded ? (
                      <p className="mt-0.5 text-[10px] font-medium text-amber-600">Ya agregado</p>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}

        <p className="mt-1 text-[11px] drflow-ehr-muted">
          Vademécum PAMI (Alfabeta). Escribí 2 letras y elegí una opción real.
        </p>
      </div>

      {medications.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {medications.map((med, index) => (
            <li
              key={`${med.vademecum_code ?? med.generic_name}-${index}`}
              className="inline-flex max-w-full items-center gap-1 rounded-full border border-teal-500/30 bg-teal-500/10 px-2.5 py-1 text-xs font-medium"
            >
              <span className="truncate">{formatPrescriptionMedicationLabel(med)}</span>
              <button
                type="button"
                aria-label={`Quitar ${formatPrescriptionMedicationLabel(med)}`}
                onClick={() => handleRemove(index)}
                className="rounded-full p-0.5 hover:bg-teal-500/20"
              >
                <X className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <Textarea
        name="indications"
        label="Indicaciones y plan terapéutico"
        rows={2}
        voiceInput
        value={indications}
        onChange={(e) => onIndicationsChange(e.target.value)}
        placeholder="Posología, indicaciones generales, controles…"
      />
    </div>
  );
}
