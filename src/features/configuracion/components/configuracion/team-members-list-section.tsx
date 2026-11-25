"use client";

import { INVITE_ROLES } from "@/features/configuracion/components/configuracion/team-invite-form-section";

import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import type { TeamMember } from "@/lib/hooks/use-team-invite-panel";
import type { UserRole } from "@/types/database";

type Props = {
  activeMembers: TeamMember[];
  inactiveMembers?: TeamMember[];
  acting: string | null;
  runAction: (
    id: string,
    action: () => Promise<{ error?: string; message?: string; success?: boolean }>
  ) => void;
  handleRemoveMember: (m: TeamMember) => void;
  handleUnlinkMember?: (m: TeamMember) => void;
  updateClinicMemberRole: (
    id: string,
    role: UserRole
  ) => Promise<{ error?: string; message?: string; success?: boolean }>;
  deactivateClinicMember: (
    id: string
  ) => Promise<{ error?: string; message?: string; success?: boolean }>;
  reactivateClinicMember?: (
    id: string
  ) => Promise<{ error?: string; message?: string; success?: boolean }>;
  restoreClinicMemberLoginAccess: (
    id: string
  ) => Promise<{ error?: string; message?: string; success?: boolean }>;
};

export function TeamMembersListSection({
  activeMembers,
  inactiveMembers = [],
  acting,
  runAction,
  handleRemoveMember,
  handleUnlinkMember,
  updateClinicMemberRole,
  deactivateClinicMember,
  reactivateClinicMember,
  restoreClinicMemberLoginAccess,
}: Props) {
  return (
    <div className="mb-6 space-y-6">
      <div>
        <h4 className="mb-2 text-sm font-semibold text-slate-800">Usuarios activos</h4>
        {activeMembers.length === 0 ? (
          <p className="text-sm text-slate-500">Sin miembros activos en el equipo.</p>
        ) : (
          <ul className="space-y-2">
            {activeMembers.map((m) => (
              <li
                key={m.id}
                className="drflow-card-light flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-900"
              >
                <div>
                  <p className="font-medium text-slate-900">
                    {m.display_name ?? m.profiles?.full_name ?? m.profiles?.email ?? "Sin nombre"}
                  </p>
                  <p className="text-xs text-slate-600">
                    {m.display_email ?? m.profiles?.email}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Select
                    value={m.role}
                    onChange={(e) =>
                      runAction(m.id, () =>
                        updateClinicMemberRole(m.id, e.target.value as UserRole)
                      )
                    }
                    options={INVITE_ROLES.map((r) => ({ value: r.value, label: r.label }))}
                    className="min-w-[140px]"
                  />
                  {m.role !== "clinic_admin" ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      loading={acting === `${m.id}-restore`}
                      onClick={() =>
                        runAction(`${m.id}-restore`, () => restoreClinicMemberLoginAccess(m.id))
                      }
                    >
                      Restablecer acceso
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    loading={acting === `${m.id}-deactivate`}
                    onClick={() =>
                      runAction(`${m.id}-deactivate`, () => deactivateClinicMember(m.id))
                    }
                  >
                    Desactivar
                  </Button>
                  {handleUnlinkMember ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      loading={acting === `${m.id}-unlink`}
                      onClick={() => handleUnlinkMember(m)}
                    >
                      Desvincular
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="border-red-200 text-red-700 hover:bg-red-50"
                    loading={acting === `${m.id}-remove`}
                    onClick={() => handleRemoveMember(m)}
                  >
                    Eliminar definitivamente
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {inactiveMembers.length > 0 ? (
        <div>
          <h4 className="mb-2 text-sm font-semibold text-slate-800">Usuarios desactivados</h4>
          <ul className="space-y-2">
            {inactiveMembers.map((m) => (
              <li
                key={m.id}
                className="drflow-card-light flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50/70 px-3 py-2 text-sm text-slate-900"
              >
                <div>
                  <p className="font-medium text-slate-900">
                    {m.display_name ?? m.profiles?.full_name ?? m.profiles?.email ?? "Sin nombre"}
                  </p>
                  <p className="text-xs text-slate-600">
                    {m.display_email ?? m.profiles?.email}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {reactivateClinicMember ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      loading={acting === `${m.id}-reactivate`}
                      onClick={() =>
                        runAction(`${m.id}-reactivate`, () => reactivateClinicMember(m.id))
                      }
                    >
                      Reactivar
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="border-red-200 text-red-700 hover:bg-red-50"
                    loading={acting === `${m.id}-remove`}
                    onClick={() => handleRemoveMember(m)}
                  >
                    Eliminar definitivamente
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
