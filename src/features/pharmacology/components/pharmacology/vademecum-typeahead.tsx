"use client";

import { Loader2, Search } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";

import { cn } from "@/shared/utils/cn";

import { searchPamiVademecum } from "@/lib/actions/pharmacology";
import type { PamiVademecumResult } from "@/types/pharmacology";

interface VademecumTypeaheadProps {
  onResults: (items: PamiVademecumResult[]) => void;
  onLoading: (loading: boolean) => void;
  onError: (error: string | null) => void;
  onQueryChange?: (query: string) => void;
  className?: string;
}

export function VademecumTypeahead({
  onResults,
  onLoading,
  onError,
  onQueryChange,
  className,
}: VademecumTypeaheadProps) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PamiVademecumResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);

  const search = useCallback(
    async (q: string) => {
      if (q.trim().length < 2) {
        setResults([]);
        setError(null);
        onResults([]);
        onError(null);
        return;
      }
      setLoading(true);
      onLoading(true);
      setError(null);
      onError(null);
      const res = await searchPamiVademecum(q);
      setLoading(false);
      onLoading(false);
      if (res.error) {
        setError(res.error);
        onError(res.error);
        setResults([]);
        onResults([]);
      } else {
        const items = res.data ?? [];
        setResults(items);
        onResults(items);
        setHighlight(0);
      }
    },
    [onError, onLoading, onResults]
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

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <label htmlFor={listId} className="mb-1.5 block text-sm font-medium text-slate-700">
        Buscar producto PAMI (marca, principio activo o laboratorio)
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
          placeholder="Ej: losartán, BETASERC, Abbott, 42415..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            onQueryChange?.(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          className="w-full rounded-lg border border-slate-300 bg-white py-3 pl-10 pr-10 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-emerald-600" />
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
          {results.map((item, i) => (
            <li
              key={item.id}
              role="option"
              aria-selected={i === highlight}
              onMouseEnter={() => setHighlight(i)}
              className={cn(
                "cursor-default px-4 py-2.5 transition-colors",
                i === highlight ? "bg-emerald-50" : "hover:bg-slate-50"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">{item.brand_name}</p>
                  <p className="text-xs text-slate-600">
                    {item.active_ingredient} · {item.presentation}
                  </p>
                  {item.laboratory ? (
                    <p className="mt-0.5 text-xs text-slate-500">{item.laboratory}</p>
                  ) : null}
                </div>
                <span className="shrink-0 rounded bg-slate-100 px-2 py-0.5 font-mono text-[10px] font-semibold text-emerald-800">
                  {item.alfabeta_id}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
