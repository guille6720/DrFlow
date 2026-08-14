"use client";

import { Loader2, Plus, X } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";

import { cn } from "@/shared/utils/cn";

import type { ClinicalDiagnosisEntry } from "@/features/historias/utils/clinical-structured-entries";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { searchPathologies } from "@/lib/actions/pharmacology";
import type { PathologySearchResult } from "@/types/pharmacology";

type Props = {
  diagnoses: ClinicalDiagnosisEntry[];
  onDiagnosesChange: (diagnoses: ClinicalDiagnosisEntry[]) => void;
  className?: string;
  highlighted?: boolean;
};

export function ConsultDiagnosisField({
  diagnoses,
  onDiagnosesChange,
  className,
  highlighted = false,
}: Props) {
  const listId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PathologySearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [manualCie10, setManualCie10] = useState("");

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
    const timer = window.setTimeout(() => void search(query), 280);
    return () => window.clearTimeout(timer);
  }, [query, open, search]);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function addDiagnosis(entry: ClinicalDiagnosisEntry) {
    const key = `${entry.name}|${entry.cie10_code ?? ""}`.toLowerCase();
    if (
      diagnoses.some((d) => `${d.name}|${d.cie10_code ?? ""}`.toLowerCase() === key)
    ) {
      return;
    }
    onDiagnosesChange([...diagnoses, entry]);
  }

  function handleSelect(item: PathologySearchResult) {
    addDiagnosis({
      name: item.name,
      cie10_code: item.cie10_code,
      pathology_id: item.id,
      is_chronic: false,
    });
    setQuery("");
    setResults([]);
    setOpen(false);
  }

  function handleAddManual() {
    const name = query.trim();
    if (!name) return;
    addDiagnosis({
      name,
      cie10_code: manualCie10.trim() || null,
      is_chronic: false,
    });
    setQuery("");
    setManualCie10("");
    setOpen(false);
  }

  function handleRemove(index: number) {
    onDiagnosesChange(diagnoses.filter((_, i) => i !== index));
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" && results.length > 0) {
      event.preventDefault();
      setHighlight((h) => Math.min(h + 1, results.length - 1));
      return;
    }
    if (event.key === "ArrowUp" && results.length > 0) {
      event.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const item = results[highlight];
      if (item) handleSelect(item);
      else handleAddManual();
      return;
    }
    if (event.key === "Escape") setOpen(false);
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div ref={containerRef} className="relative space-y-2">
        <label htmlFor={listId} className="mb-1.5 block text-sm font-medium drflow-ehr-label">
          Diagnóstico
        </label>
        <input
          id={listId}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          aria-controls={`${listId}-listbox`}
          placeholder="Buscar patología / CIE-10 (ej: hipertensión, I10…)"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          className={cn(
            "drflow-clinical-combobox-input w-full rounded-md py-2.5 px-3 focus:ring-2 focus:ring-sky-400/50",
            highlighted && "ring-2 ring-sky-400/50"
          )}
        />
        <div className="flex flex-wrap items-end gap-2">
          <Input
            label="CIE-10 (opcional)"
            value={manualCie10}
            onChange={(e) => setManualCie10(e.target.value.toUpperCase())}
            placeholder="I10"
            className="max-w-[140px]"
          />
          <Button type="button" size="sm" variant="outline" onClick={handleAddManual} disabled={!query.trim()}>
            <Plus className="h-3.5 w-3.5" />
            Agregar
          </Button>
        </div>

        {loading ? (
          <p className="inline-flex items-center gap-1 text-xs text-slate-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Buscando…
          </p>
        ) : null}
        {error ? <p className="text-xs text-red-600">{error}</p> : null}

        {open && results.length > 0 ? (
          <ul
            id={`${listId}-listbox`}
            role="listbox"
            className="drflow-clinical-combobox-list absolute z-[100] mt-1 max-h-72 w-full overflow-y-auto rounded-md py-1 shadow-lg"
          >
            {results.map((item, index) => (
              <li key={item.id} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={index === highlight}
                  onMouseEnter={() => setHighlight(index)}
                  onClick={() => handleSelect(item)}
                  className={cn(
                    "w-full px-3 py-2 text-left transition-colors",
                    index === highlight && "bg-sky-500/10"
                  )}
                >
                  <p className="text-sm font-semibold">{item.name}</p>
                  <p className="text-xs text-slate-500">CIE-10: {item.cie10_code}</p>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <p className="drflow-clinical-combobox-hint text-xs">
          Autocompletado desde catálogo de patologías. Podés agregar texto libre + CIE-10.
        </p>
      </div>

      {diagnoses.length > 0 ? (
        <ul className="space-y-1.5">
          {diagnoses.map((d, index) => (
            <li
              key={`${d.name}-${d.cie10_code ?? index}`}
              className="flex items-start justify-between gap-2 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-slate-800"
            >
              <div>
                <p className="font-medium">{d.name}</p>
                {d.cie10_code ? (
                  <p className="text-xs font-semibold text-sky-700">CIE-10: {d.cie10_code}</p>
                ) : null}
              </div>
              <button
                type="button"
                aria-label={`Quitar ${d.name}`}
                onClick={() => handleRemove(index)}
                className="rounded p-1 text-slate-500 hover:bg-sky-100"
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
