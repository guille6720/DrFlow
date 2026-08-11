"use client";

import { Loader2, Search } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";

import { cn } from "@/shared/utils/cn";

import {
  formatVademecumPrescriptionLabel,
  formatVademecumPrescriptionSubtitle,
  vademecumToPrescription,
} from "@/features/recetas/components/recetas/vademecum-to-prescription";

import { searchPamiVademecum } from "@/lib/actions/pharmacology";
import type { PamiVademecumResult } from "@/types/pharmacology";
import type { PrescriptionMedication } from "@/types/prescription";

type Props = {
  onAdd: (medication: PrescriptionMedication) => void;
  existingGenericNames?: string[];
  className?: string;
};

/** Drapp-style treatment search: type prefix → pick from vademécum alternatives. */
export function PrescriptionMedicationSearch({ onAdd, existingGenericNames = [], className }: Props) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PamiVademecumResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);

  const existing = new Set(existingGenericNames.map((name) => name.toLowerCase()));

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
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
    const t = setTimeout(() => void search(query), 280);
    return () => clearTimeout(t);
  }, [query, open, search]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleSelect(item: PamiVademecumResult) {
    onAdd(vademecumToPrescription(item));
    setQuery("");
    setResults([]);
    setOpen(false);
    inputRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = results[highlight];
      if (item) handleSelect(item);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

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
          placeholder="Ej: rosu, losartán, enalapril…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          className="w-full rounded-lg border border-slate-300 bg-white py-3 pl-10 pr-10 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
        />
        {loading ? (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-teal-600" />
        ) : null}
      </div>

      {error ? (
        <p className="mt-2 text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      {open && query.length >= 2 && !loading && results.length === 0 && !error ? (
        <p className="mt-2 text-sm text-slate-500">
          Sin alternativas para &quot;{query}&quot;. Probá con menos letras o revisá la ortografía.
        </p>
      ) : null}

      {open && results.length > 0 ? (
        <ul
          id={`${listId}-listbox`}
          role="listbox"
          className="absolute z-[100] mt-1 max-h-80 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-xl ring-1 ring-black/5"
        >
          {results.map((item, i) => {
            const genericKey = item.active_ingredient.trim().toLowerCase();
            const alreadyAdded = existing.has(genericKey);
            return (
              <li key={item.id} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={i === highlight}
                  onMouseEnter={() => setHighlight(i)}
                  onClick={() => handleSelect(item)}
                  className={cn(
                    "w-full px-4 py-2.5 text-left transition-colors",
                    i === highlight ? "bg-teal-50" : "hover:bg-slate-50",
                    alreadyAdded && "opacity-70"
                  )}
                >
                  <p className="text-sm font-semibold uppercase tracking-wide text-slate-900">
                    {formatVademecumPrescriptionLabel(item)}
                  </p>
                  <p className="text-xs text-slate-600">{formatVademecumPrescriptionSubtitle(item)}</p>
                  {alreadyAdded ? (
                    <p className="mt-0.5 text-[10px] font-medium text-amber-700">Ya en la receta</p>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      <p className="mt-2 text-xs text-slate-500">
        Escribí al menos 2 letras y elegí una alternativa del vademécum (marca, genérico, laboratorio).
      </p>
    </div>
  );
}
