"use client";

import { cn } from "@/shared/utils/cn";

import {
  formatPatientEhrSidebarDate,
} from "@/features/historias/components/historias/patient-ehr-utils";
import type { PatientEhrConsultation } from "@/features/pacientes/utils/patient-ehr-model";

type PendingSidebarConsultation = {
  createdAt: string;
  professionalName: string;
};

type Props = {
  sidebarList: PatientEhrConsultation[];
  selectedId: string | null | undefined;
  pendingConsultation?: PendingSidebarConsultation | null;
  onSelect: (id: string) => void;
  hasMoreRecords?: boolean;
  loadingMoreRecords?: boolean;
  onLoadMoreRecords?: () => void;
  loadedRecordsCount?: number;
  totalRecordsCount?: number;
};

export function PatientEhrSidebar({
  sidebarList,
  selectedId,
  pendingConsultation = null,
  onSelect,
  hasMoreRecords = false,
  loadingMoreRecords = false,
  onLoadMoreRecords,
  loadedRecordsCount: _loadedRecordsCount,
  totalRecordsCount,
}: Props) {
  return (
    <aside className="drflow-ehr-sidebar w-full shrink-0 border-b border-[var(--border)] lg:flex lg:w-56 lg:min-h-0 lg:flex-col lg:border-b-0 lg:border-r">
      <div className="max-h-48 overflow-y-auto lg:min-h-0 lg:max-h-none lg:flex-1 lg:overflow-y-auto">
        {sidebarList.length === 0 && !pendingConsultation ? (
          <p className="p-4 text-center text-xs drflow-ehr-muted">Sin evoluciones</p>
        ) : (
          <ul>
            {pendingConsultation ? (
              <li key="pending-consultation">
                <div
                  className={cn(
                    "w-full border-b border-[var(--border)] px-3 py-2.5 text-left text-xs",
                    "drflow-ehr-sidebar-active"
                  )}
                >
                  <p className="font-bold">
                    {formatPatientEhrSidebarDate(pendingConsultation.createdAt)}
                  </p>
                  <p className="mt-0.5 truncate font-medium">{pendingConsultation.professionalName}</p>
                  <p className="mt-0.5 text-xs font-semibold uppercase tracking-wide text-teal-700">
                    Consulta en curso
                  </p>
                </div>
              </li>
            ) : null}
            {sidebarList.map((c) => {
              const active = !pendingConsultation && c.id === selectedId;
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(c.id)}
                    className={cn(
                      "w-full border-b border-[var(--border)] px-3 py-2.5 text-left text-xs transition",
                      active ? "drflow-ehr-sidebar-active" : "drflow-ehr-sidebar-item hover:bg-slate-100/10"
                    )}
                  >
                    <p className="font-bold">{formatPatientEhrSidebarDate(c.created_at)}</p>
                    <p className="mt-0.5 truncate font-medium">{c.professional_name}</p>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {hasMoreRecords && onLoadMoreRecords ? (
          <div className="border-t border-[var(--border)] p-3">
            <button
              type="button"
              onClick={onLoadMoreRecords}
              disabled={loadingMoreRecords}
              className="w-full rounded-md border border-[var(--border)] px-3 py-2 text-xs font-medium transition hover:bg-slate-100/10 disabled:text-slate-400"
            >
              {loadingMoreRecords
                ? "Cargando consultas…"
                : totalRecordsCount
                  ? `Cargar más (${sidebarList.length}/${totalRecordsCount})`
                  : "Cargar más consultas"}
            </button>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
