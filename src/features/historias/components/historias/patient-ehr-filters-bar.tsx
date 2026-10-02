"use client";

import { ChevronDown, ListFilter } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import {
  PATIENT_EHR_FILTER_OPTIONS,
  type PatientEhrFilterKey,
  type PatientEhrFilters,
} from "@/features/historias/components/historias/patient-ehr-types";
import { formatPatientConsultationCount } from "@/features/pacientes/utils/patient-consultation-count";

type Props = {
  filters: PatientEhrFilters;
  onToggleFilter: (key: PatientEhrFilterKey) => void;
  totalConsultations: number;
  usesHceExport?: boolean;
  /** Shown on the right, before the consultation count (e.g. print menu). */
  trailingActions?: ReactNode;
  compact?: boolean;
};

export function PatientEhrFiltersBar({
  filters,
  onToggleFilter,
  totalConsultations,
  usesHceExport = false,
  trailingActions,
  compact = false,
}: Props) {
  const filterOptions = PATIENT_EHR_FILTER_OPTIONS.map(({ key, label, icon: Icon }) => (
    <label key={key} className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium drflow-ehr-filter-label">
      <input type="checkbox" checked={filters[key]} onChange={() => onToggleFilter(key)} className="drflow-ehr-accent-checkbox h-4 w-4 rounded border-slate-400" />
      <Icon className="drflow-ehr-accent-icon h-4 w-4" aria-hidden />
      {label}
    </label>
  ));

  return (
    <>
      <div className="drflow-ehr-filters flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-[var(--border)] px-4 py-2.5">
        {compact ? (
          <details className="nexclinic-history-filters min-w-0">
            <summary className="inline-flex min-h-8 cursor-pointer list-none items-center gap-1.5 text-xs font-medium drflow-ehr-filter-label">
              <ListFilter className="h-3.5 w-3.5" aria-hidden />
              Filtros ({PATIENT_EHR_FILTER_OPTIONS.filter(({ key }) => filters[key]).length})
              <ChevronDown className="h-3.5 w-3.5" aria-hidden />
            </summary>
            <div className="flex flex-wrap gap-x-4 gap-y-2 py-2">{filterOptions}</div>
          </details>
        ) : filterOptions}
        <div className="ml-auto flex flex-wrap items-center gap-3">
          {trailingActions}
          <span className="text-xs drflow-ehr-filter-meta">
            {formatPatientConsultationCount(totalConsultations)}
          </span>
        </div>
      </div>

      {usesHceExport ? (
        <p className="drflow-ehr-hce-banner px-4 py-2">
          Datos parciales del export HCE. Completá con{" "}
          <Link href="/datos" className="font-semibold underline">
            PDF o JSONL
          </Link>
          .
        </p>
      ) : null}
    </>
  );
}
