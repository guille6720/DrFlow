"use client";

import Link from "next/link";

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
};

export function PatientEhrFiltersBar({
  filters,
  onToggleFilter,
  totalConsultations,
  usesHceExport = false,
}: Props) {
  return (
    <>
      <div className="drflow-ehr-filters flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-[var(--border)] px-4 py-2.5">
        {PATIENT_EHR_FILTER_OPTIONS.map(({ key, label, icon: Icon }) => (
          <label
            key={key}
            className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium drflow-ehr-filter-label"
          >
            <input
              type="checkbox"
              checked={filters[key]}
              onChange={() => onToggleFilter(key)}
              className="drflow-ehr-accent-checkbox h-4 w-4 rounded border-slate-400"
            />
            <Icon className="drflow-ehr-accent-icon h-4 w-4" />
            {label}
          </label>
        ))}
        <span className="ml-auto text-xs drflow-ehr-filter-meta">
          {formatPatientConsultationCount(totalConsultations)}
        </span>
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
