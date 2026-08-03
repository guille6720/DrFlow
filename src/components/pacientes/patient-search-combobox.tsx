"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils/cn";

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

export function PatientSearchCombobox({
  patients,
  name = "patient_id",
  label = "Paciente",
  required,
  placeholder = "Escribí nombre, apellido o DNI…",
  defaultPatientId,
  onPatientChange,
}: Props) {
  const initial = patients.find((p) => p.id === defaultPatientId);
  const [query, setQuery] = useState(initial ? formatLabel(initial) : "");
  const [selectedId, setSelectedId] = useState(defaultPatientId ?? "");
  const [open, setOpen] = useState(false);
  const blurTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const p = patients.find((x) => x.id === defaultPatientId);
    if (defaultPatientId && p) {
      setSelectedId(defaultPatientId);
      setQuery(formatLabel(p));
    } else if (!defaultPatientId) {
      setSelectedId("");
      setQuery("");
    }
  }, [defaultPatientId, patients]);

  const filtered = useMemo(() => {
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
  }, [patients, query]);

  function pick(p: PatientSearchOption) {
    setSelectedId(p.id);
    setQuery(formatLabel(p));
    setOpen(false);
    onPatientChange?.(p.id);
  }

  function handleBlur() {
    blurTimeout.current = setTimeout(() => setOpen(false), 150);
  }

  function handleFocus() {
    if (blurTimeout.current) clearTimeout(blurTimeout.current);
    setOpen(true);
  }

  return (
    <div className="relative space-y-1">
      <label className="drflow-ui-label block text-sm font-medium">
        {label}
        {required ? <span className="text-red-400"> *</span> : null}
      </label>
      <input type="hidden" name={name} value={selectedId} required={required} />
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-teal-500/80" />
        <input
          type="search"
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
          className="drflow-ui-input w-full rounded-xl border py-2.5 pl-10 pr-3 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
        />
      </div>
      {open && filtered.length > 0 && (
        <ul
          className="drflow-ui-dropdown absolute mt-1 max-h-56 w-full overflow-y-auto rounded-xl py-1"
          onMouseDown={(e) => e.preventDefault()}
        >
          {filtered.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                className={cn(
                  "drflow-ui-dropdown-item w-full px-3 py-2 text-left text-sm",
                  selectedId === p.id && "bg-teal-950/60 text-teal-200"
                )}
                aria-selected={selectedId === p.id}
                onClick={() => pick(p)}
              >
                <span className="font-medium">
                  {p.last_name}, {p.first_name}
                </span>
                <span className="ml-2 text-xs opacity-70">DNI {p.document_number}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && query.trim() && filtered.length === 0 && (
        <p className="drflow-ui-dropdown absolute mt-1 w-full rounded-xl px-3 py-2 text-xs opacity-80">
          Sin coincidencias. Probá otro nombre o DNI.
        </p>
      )}
    </div>
  );
}
