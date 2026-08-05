"use client";

import { INVITE_ROLES } from "@/features/configuracion/components/configuracion/team-invite-form-section";

import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import type { TeamMember } from "@/lib/hooks/use-team-invite-panel";
import type { UserRole } from "@/types/database";

type Props = {
  activeMembers: TeamMember[];
  acting: string | null;
  runAction: (id: string, action: () => Promise<{ error?: string }>) => void;
  handleRemoveMember: (m: TeamMember) => void;
  updateClinicMemberRole: (id: string, role: UserRole) => Promise<{ error?: string }>;
  deactivateClinicMember: (id: string) => Promise<{ error?: string }>;
};

export function TeamMembersListSection({
  activeMembers,
  acting,
  runAction,
  handleRemoveMember,
  updateClinicMemberRole,
  deactivateClinicMember,
}: Props) {
  return (
    <div className="mb-6">
      <h4 className="mb-2 text-sm font-semibold text-slate-800">Usuarios activos</h4>
      {activeMembers.length === 0 ? (
        <p className="text-sm text-slate-500">Sin miembros en el equipo.</p>
      ) : (
        <ul className="space-y-2">
          {activeMembers.map((m) => (
            <li
              key={m.id}
              className="drflow-card-light flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-900"
            >
              <div>
                <p className="font-medium text-slate-900">{m.profiles?.full_name ?? "Usuario"}</p>
                <p className="text-xs text-slate-600">{m.profiles?.email}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Select
                  value={m.role}
                  onChange={(e) =>
                    runAction(m.id, () => updateClinicMemberRole(m.id, e.target.value as UserRole))
                  }
                  options={INVITE_ROLES.map((r) => ({ value: r.value, label: r.label }))}
                  className="min-w-[140px]"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  loading={acting === `${m.id}-deactivate`}
                  onClick={() => runAction(`${m.id}-deactivate`, () => deactivateClinicMember(m.id))}
                >
                  Desactivar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="border-red-200 text-red-700 hover:bg-red-50"
                  loading={acting === `${m.id}-remove`}
                  onClick={() => handleRemoveMember(m)}
                >
                  Eliminar cuenta
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
