"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Search, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { searchPathologies } from "@/lib/actions/pharmacology";
import type { PathologySearchResult } from "@/types/pharmacology";

interface PathologyTypeaheadProps {
  onSelect: (pathology: PathologySearchResult) => void;
  selected?: PathologySearchResult | null;
  onClear?: () => void;
  className?: string;
}

export function PathologyTypeahead({
  onSelect,
  selected,
  onClear,
  className,
}: PathologyTypeaheadProps) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
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
    if (!open || selected) return;
    const t = setTimeout(() => search(query), 280);
    return () => clearTimeout(t);
  }, [query, open, selected, search]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleSelect(p: PathologySearchResult) {
    onSelect(p);
    setQuery("");
    setResults([]);
    setOpen(false);
  }

  function handleClear() {
    setQuery("");
    setResults([]);
    onClear?.();
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
    } else if (e.key === "Enter" && results[highlight]) {
      e.preventDefault();
      handleSelect(results[highlight]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  if (selected) {
    return (
      <div
        className={cn(
          "flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50/60 px-4 py-3",
          className
        )}
      >
        <div>
          <p className="font-medium text-slate-900">{selected.name}</p>
          <p className="text-sm text-blue-700">
            CIE-10: <span className="font-mono font-semibold">{selected.cie10_code}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={handleClear}
          className="rounded-lg p-2 text-slate-500 hover:bg-white hover:text-slate-700"
          aria-label="Limpiar selección"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <label htmlFor={listId} className="mb-1.5 block text-sm font-medium text-slate-700">
        Buscar patología (nombre o CIE-10)
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
          placeholder="Ej: I10, diabetes, asma, hipertensión..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          className="w-full rounded-lg border border-slate-300 bg-white py-3 pl-10 pr-10 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-blue-600" />
        )}
      </div>

      {error && (
        <p className="mt-2 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      {open && query.length >= 2 && !loading && results.length === 0 && !error && (
        <p className="mt-2 text-sm text-slate-500">Sin resultados para &quot;{query}&quot;</p>
      )}

      {open && results.length > 0 && (
        <ul
          id={`${listId}-listbox`}
          role="listbox"
          className="absolute z-[100] mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg ring-1 ring-black/5"
        >
          {results.map((p, i) => (
            <li
              key={p.id}
              role="option"
              aria-selected={i === highlight}
              onMouseEnter={() => setHighlight(i)}
              onClick={() => handleSelect(p)}
              className={cn(
                "cursor-pointer px-4 py-2.5 transition-colors",
                i === highlight ? "bg-blue-50" : "hover:bg-slate-50"
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="min-w-0 flex-1 text-sm font-medium leading-snug text-slate-900">
                  {p.name}
                </span>
                <span className="shrink-0 rounded bg-slate-100 px-2 py-0.5 font-mono text-xs font-semibold text-blue-800">
                  {p.cie10_code}
                </span>
              </div>
              {p.description && (
                <p className="mt-1 text-xs leading-relaxed text-slate-500">{p.description}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
