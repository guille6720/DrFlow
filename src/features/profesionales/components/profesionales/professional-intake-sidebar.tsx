"use client";

import { Plus, UserRound } from "lucide-react";

import { cn } from "@/shared/utils/cn";

import { ClinicTeamMembersSidebarSection } from "@/features/profesionales/components/profesionales/clinic-team-members-sidebar-section";

import type { EnrichedTeamMember } from "@/lib/utils/team-member-display";

export type ProfessionalListItem = {
  id: string;
  display_name: string | null;
  specialties?: { name: string } | null;
  intake_completed_at?: string | null;
};

interface Props {
  professionals: ProfessionalListItem[];
  teamMembers: EnrichedTeamMember[];
  selectedId: string | null;
  selectedMemberId: string | null;
  isNew: boolean;
  onSelect: (id: string) => void;
  onSelectMember: (memberId: string) => void;
  onNew: () => void;
}

function initials(name: string | null): string {
  if (!name) return "?";
  const parts = name.replace(",", " ").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

export function ProfessionalIntakeSidebar({
  professionals,
  teamMembers,
  selectedId,
  selectedMemberId,
  isNew,
  onSelect,
  onSelectMember,
  onNew,
}: Props) {
  return (
    <aside className="flex h-full min-h-[520px] w-full flex-col rounded-2xl border border-slate-200 bg-slate-50/80 shadow-sm lg:w-72 lg:shrink-0">
      <div className="border-b border-slate-200 px-4 py-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Equipo médico
        </p>
        <button
          type="button"
          onClick={onNew}
          className={cn(
            "mt-3 flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition",
            isNew
              ? "bg-gradient-to-r from-teal-500 to-cyan-500 text-slate-900 shadow-md"
              : "border border-teal-200 bg-white text-teal-800 hover:bg-teal-50"
          )}
        >
          <Plus className="h-4 w-4" />
          Nuevo profesional
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {professionals.length === 0 ? (
          <p className="px-2 py-4 text-sm text-slate-500">
            Todavía no hay profesionales. Creá el primero con el botón de arriba.
          </p>
        ) : (
          <ul className="space-y-1">
            {professionals.map((p) => {
              const active = !isNew && !selectedMemberId && selectedId === p.id;
              const name = p.display_name ?? "Profesional";
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(p.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition",
                      active
                        ? "bg-gradient-to-r from-teal-500 to-cyan-500 text-slate-900 shadow-md shadow-teal-500/20"
                        : "text-slate-700 hover:bg-white hover:shadow-sm"
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                        active ? "bg-white/90 text-teal-800" : "bg-teal-100 text-teal-800"
                      )}
                    >
                      {initials(name)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{name}</span>
                      <span
                        className={cn(
                          "block truncate text-xs",
                          active ? "text-slate-800/80" : "text-slate-500"
                        )}
                      >
                        {p.specialties?.name ?? "Sin especialidad"}
                      </span>
                    </span>
                    {!p.intake_completed_at ? (
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase",
                          active ? "bg-white/80 text-amber-800" : "bg-amber-100 text-amber-800"
                        )}
                      >
                        Pend.
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <ClinicTeamMembersSidebarSection
        members={teamMembers}
        selectedMemberId={selectedMemberId}
        onSelect={onSelectMember}
      />

      <div className="border-t border-slate-200 px-4 py-3 text-xs text-slate-500">
        <UserRound className="mb-1 inline h-3.5 w-3.5 text-teal-600" />{" "}
        {professionals.length} profesional{professionals.length === 1 ? "" : "es"}
      </div>
    </aside>
  );
}
