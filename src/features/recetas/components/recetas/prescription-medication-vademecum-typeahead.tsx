"use client";

import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";

import { cn } from "@/shared/utils/cn";

import {
  formatVademecumPrescriptionLabel,
  formatVademecumPrescriptionSubtitle,
} from "@/features/recetas/components/recetas/vademecum-to-prescription";

import { searchPamiVademecum } from "@/lib/actions/pharmacology";
import type { PamiVademecumResult } from "@/types/pharmacology";

type Props = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onSelect: (item: PamiVademecumResult) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
};

export function PrescriptionMedicationVademecumTypeahead({
  label,
  value,
  onChange,
  onSelect,
  placeholder,
  required,
  className,
}: Props) {
  const listId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const [results, setResults] = useState<PamiVademecumResult[]>([]);
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
    const t = setTimeout(() => void search(value), 280);
    return () => clearTimeout(t);
  }, [value, open, search]);

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
    onSelect(item);
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
    <div ref={containerRef} className={cn("relative space-y-1", className)}>
      <label htmlFor={listId} className="drflow-ui-label block text-sm font-medium text-slate-700">
        {label}
      </label>
      <div className="relative">
        <input
          id={listId}
          type="text"
          required={required}
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          aria-controls={`${listId}-listbox`}
          placeholder={placeholder}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          className="drflow-ui-input w-full rounded-xl border border-slate-200 px-3 py-2 text-sm placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
        />
        {loading ? (
          <Loader2 className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-teal-600" />
        ) : null}
      </div>

      {error ? (
        <p className="text-xs text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      {open && value.trim().length >= 2 && !loading && results.length === 0 && !error ? (
        <p className="text-xs text-slate-500">Sin coincidencias — podés escribir el medicamento manualmente.</p>
      ) : null}

      {open && results.length > 0 ? (
        <ul
          id={`${listId}-listbox`}
          role="listbox"
          className="absolute z-[100] mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg ring-1 ring-black/5"
        >
          {results.map((item, i) => (
            <li
              key={item.id}
              role="option"
              aria-selected={i === highlight}
              onMouseEnter={() => setHighlight(i)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSelect(item)}
              className={cn(
                "cursor-pointer px-3 py-2 transition-colors",
                i === highlight ? "bg-teal-50" : "hover:bg-slate-50"
              )}
            >
              <p className="text-sm font-semibold text-slate-900">
                {formatVademecumPrescriptionLabel(item)}
              </p>
              <p className="text-xs text-slate-600">{formatVademecumPrescriptionSubtitle(item)}</p>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
