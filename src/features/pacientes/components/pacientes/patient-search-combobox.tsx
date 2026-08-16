"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { type KeyboardEvent, useId, useMemo, useRef, useState } from "react";

import { FloatingAnchorPanel } from "@/core/components/ui/floating-anchor-panel";
import { useAsyncPatientSearch } from "@/core/hooks/use-async-patient-search";
import { PATIENT_SEARCH_API_LIMIT } from "@/core/supabase/pagination";

import { cn } from "@/shared/utils/cn";

import { formatAgeLabel, isPamiPatient } from "@/features/pacientes/utils/patient-age";
import {
  PATIENT_SEARCH_MIN_TEXT_LENGTH,
  resolvePatientSearchMinLength,
  shouldExecutePatientSearch,
} from "@/features/pacientes/utils/patient-search-query";

import { Badge } from "@/components/ui/badge";

export type PatientSearchOption = {
  id: string;
  first_name: string;
  last_name: string;
  document_number: string;
  birth_date?: string | null;
  phone?: string | null;
  insurance_provider?: string | null;
  insurance_plan?: string | null;
};

interface Props {
  /** Seed rows for the selected/default patient (not used as a full local catalog). */
  patients: PatientSearchOption[];
  name?: string;
  label?: string;
  required?: boolean;
  placeholder?: string;
  defaultPatientId?: string;
  onPatientChange?: (patientId: string, patient?: PatientSearchOption) => void;
  /** When `remote`, searches via API instead of filtering a local catalog. */
  searchMode?: "local" | "remote";
  cobertura?: "pami";
  /** Minimum characters before remote search runs (default 2). */
  minSearchLength?: number;
  /** Max API results when `searchMode` is `remote`. */
  searchResultLimit?: number;
  /** When set, shows a create-patient link if there are no matches. */
  createPatientHref?: (query: string) => string;
  /** Rich rows (name + DNI/edad/tel/obra social) like the Pacientes list. */
  displayMode?: "compact" | "detailed";
}

function normalize(s: string) {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
}

function formatSelectedLabel(p: PatientSearchOption) {
  return `${p.last_name}, ${p.first_name}`;
}

function optionId(listboxId: string, patientId: string) {
  return `${listboxId}-option-${patientId}`;
}

function buildPatientOptionMeta(p: PatientSearchOption): string {
  const parts = [
    `DNI ${p.document_number}`,
    formatAgeLabel(p.birth_date),
    p.phone,
    p.insurance_provider ?? "Sin obra social",
    p.insurance_plan,
  ].filter(Boolean);

  return parts.join(" · ");
}

export function PatientSearchCombobox({
  patients,
  name = "patient_id",
  label = "Paciente",
  required,
  placeholder = "Escribí nombre, apellido o DNI…",
  defaultPatientId,
  onPatientChange,
  searchMode = "remote",
  cobertura,
  minSearchLength,
  searchResultLimit = PATIENT_SEARCH_API_LIMIT,
  createPatientHref,
  displayMode = "compact",
}: Props) {
  const inputId = useId();
  const listboxId = useId();
  const statusId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const initial = patients.find((p) => p.id === defaultPatientId);
  const [query, setQuery] = useState(initial ? formatSelectedLabel(initial) : "");
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
      setQuery(formatSelectedLabel(p));
    } else {
      setSelectedId("");
      setQuery("");
    }
  }

  const isRemote = searchMode === "remote";
  const baseMinLength = minSearchLength ?? PATIENT_SEARCH_MIN_TEXT_LENGTH;
  const effectiveMinLength = resolvePatientSearchMinLength(query, baseMinLength);
  const { results: remoteResults, loading, error } = useAsyncPatientSearch(query, {
    cobertura,
    enabled: isRemote && open,
    minLength: baseMinLength,
    limit: searchResultLimit,
  });

  const filtered = useMemo(() => {
    if (isRemote) {
      return shouldExecutePatientSearch(query.trim(), effectiveMinLength) ? remoteResults : [];
    }
    const q = normalize(query.trim());
    if (!q) return patients.slice(0, searchResultLimit);
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
      .slice(0, searchResultLimit);
  }, [patients, query, isRemote, remoteResults, effectiveMinLength, searchResultLimit]);

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
    setQuery(formatSelectedLabel(p));
    setOpen(false);
    setActiveIndex(-1);
    onPatientChange?.(p.id, p);
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

  const trimmedQuery = query.trim();
  const showCreatePatient =
    Boolean(createPatientHref) &&
    shouldExecutePatientSearch(trimmedQuery, effectiveMinLength) &&
    !loading &&
    !error &&
    filtered.length === 0 &&
    !selectedId;
  const createHref = showCreatePatient ? createPatientHref?.(trimmedQuery) : undefined;
  const showLoading =
    loading && isRemote && shouldExecutePatientSearch(trimmedQuery, effectiveMinLength);
  const showError = Boolean(error && isRemote && !loading);
  const showResults = !loading && filtered.length > 0;
  const showEmptyHint =
    !loading && !error && Boolean(trimmedQuery) && filtered.length === 0 && !showCreatePatient;
  const panelOpen =
    open && (showLoading || showError || showResults || Boolean(showCreatePatient && createHref) || showEmptyHint);

  return (
    <div className="relative space-y-1">
      <label htmlFor={inputId} className="drflow-ui-label block text-sm font-medium">
        {label}
        {required ? <span className="text-red-400" aria-hidden="true"> *</span> : null}
      </label>
      <input type="hidden" name={name} value={selectedId} required={required} />
      <div ref={anchorRef} className="relative">
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
        {open && loading && isRemote && shouldExecutePatientSearch(trimmedQuery, effectiveMinLength)
          ? "Buscando pacientes…"
          : open && error && isRemote
            ? error
            : open && !loading && trimmedQuery && filtered.length === 0
              ? showCreatePatient
                ? "Paciente inexistente. Podés crearlo desde el enlace debajo."
                : isRemote && !shouldExecutePatientSearch(trimmedQuery, effectiveMinLength)
                  ? `Escribí al menos ${effectiveMinLength} caracteres para buscar.`
                  : "Sin coincidencias."
              : open && filtered.length > 0
                ? `${filtered.length} resultados disponibles.`
                : ""}
      </p>
      <FloatingAnchorPanel
        anchorRef={anchorRef}
        open={panelOpen}
        preferredMaxHeight={480}
        className="drflow-ui-dropdown drflow-patient-picker-dropdown rounded-xl shadow-xl"
      >
        {showLoading ? (
          <p className="px-3 py-2 text-xs text-slate-600">Buscando…</p>
        ) : null}
        {showError ? (
          <p className="px-3 py-2 text-xs text-red-700" role="alert">
            {error}
          </p>
        ) : null}
        {showResults ? (
          <ul
            id={listboxId}
            role="listbox"
            aria-label={`Resultados de ${label}`}
            className={cn("py-1", displayMode === "detailed" && "space-y-2 p-2")}
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
                    "w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-inset",
                    displayMode === "detailed"
                      ? cn(
                          "drflow-card-light rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-slate-900 shadow-sm hover:border-teal-300",
                          index === activeIndex && "border-teal-400 ring-2 ring-teal-400/30",
                          selectedId === p.id && "border-teal-500 bg-teal-50"
                        )
                      : cn(
                          "drflow-ui-dropdown-item px-3 py-2 text-sm",
                          index === activeIndex && "bg-teal-900/40",
                          selectedId === p.id && "bg-teal-950/60 text-teal-200"
                        )
                  )}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => pick(p)}
                >
                  {displayMode === "detailed" ? (
                    <>
                      <p className="font-semibold text-slate-900">
                        {p.last_name}, {p.first_name}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-700">{buildPatientOptionMeta(p)}</p>
                      {isPamiPatient(p.insurance_provider) ? (
                        <p className="mt-1.5">
                          <Badge variant="teal">PAMI</Badge>
                        </p>
                      ) : null}
                    </>
                  ) : (
                    <>
                      <span className="font-medium">
                        {p.last_name}, {p.first_name}
                      </span>
                      <span className="ml-2 text-xs opacity-80">DNI {p.document_number}</span>
                    </>
                  )}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {!loading && showCreatePatient && createHref ? (
          <div className="py-1" onMouseDown={(e) => e.preventDefault()}>
            <Link
              href={createHref}
              className="drflow-ui-dropdown-item block px-3 py-2.5 text-sm font-semibold text-slate-900 hover:bg-teal-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-inset"
            >
              Paciente inexistente, crear paciente
            </Link>
          </div>
        ) : null}
        {showEmptyHint ? (
          <p className="px-3 py-2 text-xs text-slate-600">
            {isRemote && !shouldExecutePatientSearch(trimmedQuery, effectiveMinLength)
              ? `Escribí al menos ${effectiveMinLength} caracteres para buscar.`
              : "Sin coincidencias. Probá otro nombre o DNI."}
          </p>
        ) : null}
      </FloatingAnchorPanel>
      {showCreatePatient && createHref ? (
        <div className="drflow-card-light turnos-create-patient-hint mt-2 rounded-xl border border-amber-300 bg-amber-50 p-3">
          <p className="text-sm font-semibold text-slate-900">
            Paciente inexistente,{" "}
            <Link
              href={createHref}
              className="font-semibold text-teal-800 underline decoration-2 underline-offset-2 hover:text-teal-950"
            >
              crear paciente
            </Link>
          </p>
        </div>
      ) : null}
    </div>
  );
}
