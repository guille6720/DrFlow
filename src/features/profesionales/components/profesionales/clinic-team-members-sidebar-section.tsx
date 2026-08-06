"use client";

import { Users } from "lucide-react";

import { cn } from "@/shared/utils/cn";

import type { EnrichedTeamMember } from "@/lib/utils/team-member-display";
import type { UserRole } from "@/types/database";

const ROLE_LABELS: Partial<Record<UserRole, string>> = {
  doctor: "Médico",
  secretary: "Secretaría",
  clinic_admin: "Administrador",
  superadmin: "Superadmin",
};

function initials(name: string): string {
  const parts = name.replace(",", " ").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

type Props = {
  members: EnrichedTeamMember[];
  selectedMemberId: string | null;
  onSelect: (memberId: string) => void;
};

export function ClinicTeamMembersSidebarSection({
  members,
  selectedMemberId,
  onSelect,
}: Props) {
  const activeMembers = members.filter((m) => m.is_active !== false);

  return (
    <div className="mt-4 border-t border-slate-200 pt-4">
      <p className="px-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Usuarios invitados
      </p>
      {activeMembers.length === 0 ? (
        <p className="px-2 py-3 text-sm text-slate-500">
          Todavía no hay usuarios invitados al consultorio.
        </p>
      ) : (
        <ul className="mt-2 space-y-1">
          {activeMembers.map((member) => {
            const active = selectedMemberId === member.id;
            const name = member.display_name;
            const roleLabel = ROLE_LABELS[member.role as UserRole] ?? member.role;
            return (
              <li key={member.id}>
                <button
                  type="button"
                  onClick={() => onSelect(member.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition",
                    active
                      ? "bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-md shadow-indigo-500/20"
                      : "text-slate-700 hover:bg-white hover:shadow-sm"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                      active ? "bg-white/90 text-indigo-800" : "bg-indigo-100 text-indigo-800"
                    )}
                  >
                    {initials(name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{name}</span>
                    <span
                      className={cn(
                        "block truncate text-xs",
                        active ? "text-white/85" : "text-slate-500"
                      )}
                    >
                      {roleLabel}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-3 flex items-center gap-1 px-2 text-xs text-slate-500">
        <Users className="h-3.5 w-3.5 text-indigo-600" />
        {activeMembers.length} usuario{activeMembers.length === 1 ? "" : "s"}
      </p>
    </div>
  );
}
