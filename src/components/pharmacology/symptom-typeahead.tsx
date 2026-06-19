"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Search, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { searchSymptoms } from "@/lib/actions/pharmacology";
import type { SymptomSearchResult } from "@/types/pharmacology";

interface SymptomTypeaheadProps {
  selected: SymptomSearchResult[];
  onChange: (symptoms: SymptomSearchResult[]) => void;
  className?: string;
}

export function SymptomTypeahead({ selected, onChange, className }: SymptomTypeaheadProps) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SymptomSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);

  const search = useCallback(
    async (q: string) => {
      if (q.trim().length < 2) {
        setResults([]);
        setError(null);
        return;
      }
      setLoading(true);
      setError(null);
      const res = await searchSymptoms(q);
      setLoading(false);
      if (res.error) {
        setError(res.error);
        setResults([]);
      } else {
        const ids = new Set(selected.map((s) => s.id));
        setResults((res.data ?? []).filter((s) => !ids.has(s.id)));
        setHighlight(0);
      }
    },
    [selected]
  );

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => search(query), 280);
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

  function addSymptom(symptom: SymptomSearchResult) {
    if (selected.some((s) => s.id === symptom.id)) return;
    onChange([...selected, symptom]);
    setQuery("");
    setResults([]);
    setOpen(false);
    inputRef.current?.focus();
  }

  function removeSymptom(id: string) {
    onChange(selected.filter((s) => s.id !== id));
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter" && results[highlight]) {
      e.preventDefault();
      addSymptom(results[highlight]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <label htmlFor={listId} className="mb-1.5 block text-sm font-medium text-slate-700">
        Buscar síntomas (podés agregar varios)
      </label>

      {selected.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {selected.map((symptom) => (
            <span
              key={symptom.id}
              className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-sm text-violet-900"
            >
              {symptom.name}
              <button
                type="button"
                onClick={() => removeSymptom(symptom.id)}
                className="rounded-full p-0.5 hover:bg-violet-100"
                aria-label={`Quitar ${symptom.name}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}

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
          placeholder="Ej: dolor en las piernas, dolor de cabeza, pirosis, disuria..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          className="w-full rounded-lg border border-slate-300 bg-white py-3 pl-10 pr-10 text-sm text-slate-900 placeholder:text-slate-400 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-violet-600" />
        )}
      </div>

      {error && (
        <p className="mt-2 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      {open && query.length >= 2 && !loading && results.length === 0 && !error && (
        <p className="mt-2 text-sm text-slate-500">Sin síntomas para &quot;{query}&quot;</p>
      )}

      {open && results.length > 0 && (
        <ul
          id={`${listId}-listbox`}
          role="listbox"
          className="absolute z-[100] mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg ring-1 ring-black/5"
        >
          {results.map((s, i) => (
            <li
              key={s.id}
              role="option"
              aria-selected={i === highlight}
              onMouseEnter={() => setHighlight(i)}
              onClick={() => addSymptom(s)}
              className={cn(
                "cursor-pointer px-4 py-2.5 transition-colors",
                i === highlight ? "bg-violet-50" : "hover:bg-slate-50"
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="min-w-0 flex-1 text-sm font-medium leading-snug text-slate-900">
                  {s.name}
                </span>
                {s.category && (
                  <span className="shrink-0 rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                    {s.category}
                  </span>
                )}
              </div>
              {s.description && (
                <p className="mt-1 text-xs leading-relaxed text-slate-500">{s.description}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
