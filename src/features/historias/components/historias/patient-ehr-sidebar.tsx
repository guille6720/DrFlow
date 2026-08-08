"use client";

import { cn } from "@/shared/utils/cn";

import {
  formatPatientEhrSidebarDate,
  isSameCalendarDay,
} from "@/features/historias/components/historias/patient-ehr-utils";
import type { PatientEhrConsultation } from "@/features/pacientes/utils/patient-ehr-model";

type Props = {
  sidebarList: PatientEhrConsultation[];
  selectedId: string | null | undefined;
  selectedCreatedAt?: string | null;
  onSelect: (id: string) => void;
};

export function PatientEhrSidebar({
  sidebarList,
  selectedId,
  selectedCreatedAt,
  onSelect,
}: Props) {
  return (
    <aside className="drflow-ehr-sidebar w-full shrink-0 border-b border-[var(--border)] lg:w-56 lg:border-b-0 lg:border-r">
      <div className="max-h-48 overflow-y-auto lg:max-h-[calc(100vh-16rem)] lg:min-h-[320px]">
        {sidebarList.length === 0 ? (
          <p className="p-4 text-center text-xs drflow-ehr-muted">Sin evoluciones</p>
        ) : (
          <ul>
            {sidebarList.map((c) => {
              const active =
                c.id === selectedId ||
                (selectedCreatedAt != null && isSameCalendarDay(c.created_at, selectedCreatedAt));
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(c.id)}
                    className={cn(
                      "w-full border-b border-[var(--border)] px-3 py-2.5 text-left text-xs transition",
                      active ? "drflow-ehr-sidebar-active" : "drflow-ehr-sidebar-item hover:opacity-90"
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
      </div>
    </aside>
  );
}
