"use client";

import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";

import { cn } from "@/shared/utils/cn";

import { Input } from "@/components/ui/input";
import { searchPathologies } from "@/lib/actions/pharmacology";
import type { PathologySearchResult } from "@/types/pharmacology";

type Props = {
  diagnosisText: string;
  cie10: string;
  onDiagnosisTextChange: (value: string) => void;
  onCie10Change: (value: string) => void;
  onPathologySelect?: (pathology: PathologySearchResult) => void;
};

export function PrescriptionDiagnosisFields({
  diagnosisText,
  cie10,
  onDiagnosisTextChange,
  onCie10Change,
  onPathologySelect,
}: Props) {
  const listId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const [results, setResults] = useState<PathologySearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([]);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    const res = await searchPathologies(q);
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
    const t = setTimeout(() => search(diagnosisText), 280);
    return () => clearTimeout(t);
  }, [diagnosisText, open, search]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleSelect(pathology: PathologySearchResult) {
    onDiagnosisTextChange(pathology.name);
    onCie10Change(pathology.cie10_code);
    onPathologySelect?.(pathology);
    setResults([]);
    setOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter" && results[highlight]) {
      e.preventDefault();
      handleSelect(results[highlight]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <>
      <div ref={containerRef} className="relative sm:col-span-2">
        <label htmlFor={`${listId}-diagnosis`} className="mb-1.5 block text-sm font-medium text-slate-700">
          Diagnóstico
        </label>
        <div className="relative">
          <input
            id={`${listId}-diagnosis`}
            name="diagnosis_text"
            type="text"
            required
            role="combobox"
            aria-expanded={open}
            aria-autocomplete="list"
            aria-controls={`${listId}-listbox`}
            placeholder="Escribí el diagnóstico o buscá por nombre / CIE-10…"
            value={diagnosisText}
            onChange={(e) => {
              onDiagnosisTextChange(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={handleKeyDown}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
          />
          {loading ? (
            <Loader2 className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-teal-600" />
          ) : null}
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Elegí una opción de la lista o escribí el diagnóstico manualmente.
        </p>

        {error ? (
          <p className="mt-1 text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}

        {open && diagnosisText.trim().length >= 2 && !loading && results.length === 0 && !error ? (
          <p className="mt-1 text-sm text-slate-500">
            Sin coincidencias en la guía — podés usar el texto que escribiste.
          </p>
        ) : null}

        {open && results.length > 0 ? (
          <ul
            id={`${listId}-listbox`}
            role="listbox"
            className="absolute z-[100] mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg ring-1 ring-black/5"
          >
            {results.map((p, i) => (
              <li
                key={p.id}
                role="option"
                aria-selected={i === highlight}
                onMouseEnter={() => setHighlight(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(p)}
                className={cn(
                  "cursor-pointer px-4 py-2.5 transition-colors",
                  i === highlight ? "bg-teal-50" : "hover:bg-slate-50"
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="min-w-0 flex-1 text-sm font-medium leading-snug text-slate-900">
                    {p.name}
                  </span>
                  <span className="shrink-0 rounded bg-slate-100 px-2 py-0.5 font-mono text-xs font-semibold text-teal-800">
                    {p.cie10_code}
                  </span>
                </div>
                {p.description ? (
                  <p className="mt-1 text-xs leading-relaxed text-slate-500">{p.description}</p>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <Input
        name="diagnosis_cie10"
        label="CIE-10"
        required
        value={cie10}
        onChange={(e) => onCie10Change(e.target.value)}
        placeholder="Ej: I10, J06.9"
      />
    </>
  );
}
