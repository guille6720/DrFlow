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
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  editingId?: string | null;
  deletingId?: string | null;
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
  onEdit,
  onDelete,
  editingId = null,
  deletingId = null,
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
              const canEdit = Boolean(onEdit) && !c.id.startsWith("hce-");
              const canDelete = Boolean(onDelete) && !c.id.startsWith("hce-");
              const isDeleting = deletingId === c.id;
              return (
                <li key={c.id}>
                  <div
                    className={cn(
                      "flex w-full items-start justify-between gap-2 border-b border-[var(--border)] px-3 py-2.5 text-xs",
                      active ? "drflow-ehr-sidebar-active" : "drflow-ehr-sidebar-item"
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => onSelect(c.id)}
                      className="min-w-0 flex-1 text-left transition hover:opacity-90"
                    >
                      <p className="font-bold">{formatPatientEhrSidebarDate(c.created_at)}</p>
                      <p className="mt-0.5 truncate font-medium">{c.professional_name}</p>
                    </button>
                    {canEdit || canDelete ? (
                      <div className="flex shrink-0 items-start gap-2 pt-0.5">
                        {canEdit ? (
                          <button
                            type="button"
                            onClick={() => onEdit?.(c.id)}
                            className="drflow-ehr-action-link text-[11px] font-semibold hover:underline"
                          >
                            {editingId === c.id ? "Editando" : "Editar"}
                          </button>
                        ) : null}
                        {canDelete ? (
                          <button
                            type="button"
                            disabled={isDeleting}
                            onClick={() => onDelete?.(c.id)}
                            className="text-[11px] font-semibold text-[var(--destructive,#b91c1c)] hover:underline disabled:opacity-60"
                          >
                            {isDeleting ? "Eliminando…" : "Eliminar"}
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
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
                  ? `Ver anteriores (${sidebarList.length}/${totalRecordsCount})`
                  : "Ver anteriores"}
            </button>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
