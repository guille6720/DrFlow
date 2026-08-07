"use client";

import { Search } from "lucide-react";
import { type KeyboardEvent, useId, useMemo, useRef, useState } from "react";

import { useAsyncPatientSearch } from "@/core/hooks/use-async-patient-search";

import { cn } from "@/shared/utils/cn";

export type PatientSearchOption = {
  id: string;
  first_name: string;
  last_name: string;
  document_number: string;
};

interface Props {
  patients: PatientSearchOption[];
  name?: string;
  label?: string;
  required?: boolean;
  placeholder?: string;
  defaultPatientId?: string;
  onPatientChange?: (patientId: string) => void;
  /** When `remote`, searches via API instead of filtering the full local list. */
  searchMode?: "local" | "remote";
  cobertura?: "pami";
}

function normalize(s: string) {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
}

function formatLabel(p: PatientSearchOption) {
  return `${p.last_name}, ${p.first_name} · DNI ${p.document_number}`;
}

function optionId(listboxId: string, patientId: string) {
  return `${listboxId}-option-${patientId}`;
}

export function PatientSearchCombobox({
  patients,
  name = "patient_id",
  label = "Paciente",
  required,
  placeholder = "Escribí nombre, apellido o DNI…",
  defaultPatientId,
  onPatientChange,
  searchMode = "local",
  cobertura,
}: Props) {
  const inputId = useId();
  const listboxId = useId();
  const statusId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const initial = patients.find((p) => p.id === defaultPatientId);
  const [query, setQuery] = useState(initial ? formatLabel(initial) : "");
  const [selectedId, setSelectedId] = useState(defaultPatientId ?? "");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const blurTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [prevDefaultPatientId, setPrevDefaultPatientId] = useState(defaultPatientId);

  if (defaultPatientId !== prevDefaultPatientId) {
    setPrevDefaultPatientId(defaultPatientId);
    const p = patients.find((x) => x.id === defaultPatientId);
    if (defaultPatientId && p) {
      setSelectedId(defaultPatientId);
      setQuery(formatLabel(p));
    } else {
      setSelectedId("");
      setQuery("");
    }
  }

  const isRemote = searchMode === "remote";
  const { results: remoteResults, loading } = useAsyncPatientSearch(query, {
    cobertura,
    enabled: isRemote && open,
  });

  const filtered = useMemo(() => {
    if (isRemote) {
      return query.trim().length >= 2 ? remoteResults : patients.slice(0, 12);
    }
    const q = normalize(query.trim());
    if (!q) return patients.slice(0, 12);
    const qDigits = q.replace(/\D/g, "");
    return patients
      .filter((p) => {
        const blob = normalize(
          `${p.first_name} ${p.last_name} ${p.document_number} ${p.last_name}, ${p.first_name}`
        );
        if (blob.includes(q)) return true;
        if (qDigits.length >= 3) {
          return p.document_number.replace(/\D/g, "").includes(qDigits);
        }
        return false;
      })
      .slice(0, 12);
  }, [patients, query, isRemote, remoteResults]);

  const filteredKey = filtered.map((p) => p.id).join(",");
  const [syncOpen, setSyncOpen] = useState(open);
  const [syncFilteredKey, setSyncFilteredKey] = useState(filteredKey);

  if (open !== syncOpen || filteredKey !== syncFilteredKey) {
    setSyncOpen(open);
    setSyncFilteredKey(filteredKey);
    setActiveIndex(!open ? -1 : filtered.length > 0 ? 0 : -1);
  }

  const activeOptionId =
    open && activeIndex >= 0 && filtered[activeIndex]
      ? optionId(listboxId, filtered[activeIndex].id)
      : undefined;

  function pick(p: PatientSearchOption) {
    setSelectedId(p.id);
    setQuery(formatLabel(p));
    setOpen(false);
    setActiveIndex(-1);
    onPatientChange?.(p.id);
  }

  function handleBlur() {
    blurTimeout.current = setTimeout(() => {
      setOpen(false);
      setActiveIndex(-1);
    }, 150);
  }

  function handleFocus() {
    if (blurTimeout.current) clearTimeout(blurTimeout.current);
    setOpen(true);
  }

  function handleInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      if (filtered.length === 0) return;

      setActiveIndex((current) => {
        if (event.key === "ArrowDown") {
          return current >= filtered.length - 1 ? 0 : current + 1;
        }
        return current <= 0 ? filtered.length - 1 : current - 1;
      });
      return;
    }

    if (!open) return;

    switch (event.key) {
      case "Enter": {
        const active = activeIndex >= 0 ? filtered[activeIndex] : undefined;
        if (active) {
          event.preventDefault();
          pick(active);
        }
        break;
      }
      case "Escape":
        event.preventDefault();
        setOpen(false);
        setActiveIndex(-1);
        break;
      case "Home":
        if (filtered.length > 0) {
          event.preventDefault();
          setActiveIndex(0);
        }
        break;
      case "End":
        if (filtered.length > 0) {
          event.preventDefault();
          setActiveIndex(filtered.length - 1);
        }
        break;
      default:
        break;
    }
  }

  return (
    <div className="relative space-y-1">
      <label htmlFor={inputId} className="drflow-ui-label block text-sm font-medium">
        {label}
        {required ? <span className="text-red-400" aria-hidden="true"> *</span> : null}
      </label>
      <input type="hidden" name={name} value={selectedId} required={required} />
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-teal-500/80" aria-hidden />
        <input
          ref={inputRef}
          id={inputId}
          type="search"
          role="combobox"
          aria-expanded={open}
          aria-controls={open && filtered.length > 0 ? listboxId : undefined}
          aria-autocomplete="list"
          aria-activedescendant={activeOptionId}
          aria-describedby={statusId}
          autoComplete="off"
          value={query}
          placeholder={placeholder}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelectedId("");
            onPatientChange?.("");
            setOpen(true);
          }}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleInputKeyDown}
          className="drflow-ui-input w-full rounded-xl border py-2.5 pl-10 pr-3 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
        />
      </div>
      <p id={statusId} className="sr-only" aria-live="polite" aria-atomic="true">
        {open && loading && isRemote && query.trim().length >= 2
          ? "Buscando pacientes…"
          : open && !loading && query.trim() && filtered.length === 0
            ? isRemote && query.trim().length < 2
              ? "Escribí al menos 2 caracteres para buscar."
              : "Sin coincidencias."
            : open && filtered.length > 0
              ? `${filtered.length} resultados disponibles.`
              : ""}
      </p>
      {open && loading && isRemote && query.trim().length >= 2 && (
        <p className="drflow-ui-dropdown absolute mt-1 w-full rounded-xl px-3 py-2 text-xs text-slate-600" aria-hidden>
          Buscando…
        </p>
      )}
      {open && !loading && filtered.length > 0 && (
        <ul
          id={listboxId}
          role="listbox"
          aria-label={`Resultados de ${label}`}
          className="drflow-ui-dropdown absolute mt-1 max-h-56 w-full overflow-y-auto rounded-xl py-1"
          onMouseDown={(e) => e.preventDefault()}
        >
          {filtered.map((p, index) => (
            <li
              key={p.id}
              id={optionId(listboxId, p.id)}
              role="option"
              aria-selected={selectedId === p.id}
            >
              <button
                type="button"
                className={cn(
                  "drflow-ui-dropdown-item w-full px-3 py-2 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-inset",
                  index === activeIndex && "bg-teal-900/40",
                  selectedId === p.id && "bg-teal-950/60 text-teal-200"
                )}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => pick(p)}
              >
                <span className="font-medium">
                  {p.last_name}, {p.first_name}
                </span>
                <span className="ml-2 text-xs text-slate-600">DNI {p.document_number}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && !loading && query.trim() && filtered.length === 0 && (
        <p className="drflow-ui-dropdown absolute mt-1 w-full rounded-xl px-3 py-2 text-xs text-slate-600" aria-hidden>
          {isRemote && query.trim().length < 2
            ? "Escribí al menos 2 caracteres para buscar."
            : "Sin coincidencias. Probá otro nombre o DNI."}
        </p>
      )}
    </div>
  );
}
