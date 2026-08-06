"use client";

import { useRouter } from "next/navigation";

import {
  canEditMemberPermissions,
  getEffectivePermissionsForRole,
  MANAGEABLE_PERMISSION_KEYS,
  MANAGEABLE_PERMISSION_LABELS,
  type ManageablePermissionKey,
} from "@/core/permissions/member-permissions";
import { ROLE_LABELS } from "@/core/permissions/roles";

import { cn } from "@/shared/utils/cn";

import {
  type TeamPermissionMember,
  updateClinicMemberPermission,
  updateClinicMemberUsesSharedAi,
} from "@/lib/actions/team-permissions";
import type { UserRole } from "@/types/database";

type Props = {
  members: TeamPermissionMember[];
  permissionOverrides: Record<string, Partial<Record<ManageablePermissionKey, boolean>>>;
  hasSharedCredentials: boolean;
  acting: string | null;
  onActingChange: (id: string | null) => void;
  onError: (message: string | null) => void;
};

export function TeamPermissionsMatrix({
  members,
  permissionOverrides,
  hasSharedCredentials,
  acting,
  onActingChange,
  onError,
}: Props) {
  const router = useRouter();
  const editableMembers = members.filter((m) => canEditMemberPermissions(m.role as UserRole));

  if (editableMembers.length === 0) {
    return (
      <p className="text-sm text-slate-600">
        Solo hay administradores en el equipo. Invitá médicos o secretaría para asignar permisos.
      </p>
    );
  }

  async function togglePermission(
    member: TeamPermissionMember,
    permission: ManageablePermissionKey,
    nextGranted: boolean
  ) {
    const actionId = `${member.id}-${permission}`;
    onActingChange(actionId);
    onError(null);
    const result = await updateClinicMemberPermission(member.id, permission, nextGranted);
    onActingChange(null);
    if (result.error) onError(result.error);
    else router.refresh();
  }

  async function toggleSharedAi(member: TeamPermissionMember, nextValue: boolean) {
    const actionId = `${member.id}-shared-ai`;
    onActingChange(actionId);
    onError(null);
    const result = await updateClinicMemberUsesSharedAi(member.id, nextValue);
    onActingChange(null);
    if (result.error) onError(result.error);
    else router.refresh();
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="sticky left-0 z-10 bg-slate-50 px-3 py-2 font-semibold text-slate-800">
              Usuario
            </th>
            <th className="px-2 py-2 font-semibold text-slate-700">Rol</th>
            {MANAGEABLE_PERMISSION_KEYS.map((key) => (
              <th
                key={key}
                className="min-w-[7rem] px-2 py-2 text-center text-xs font-semibold text-slate-700"
                title={MANAGEABLE_PERMISSION_LABELS[key]}
              >
                <span className="line-clamp-2">{MANAGEABLE_PERMISSION_LABELS[key]}</span>
              </th>
            ))}
            <th
              className="min-w-[6rem] px-2 py-2 text-center text-xs font-semibold text-slate-700"
              title="Usa las credenciales de IA compartidas del consultorio"
            >
              IA compartida
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {editableMembers.map((member) => {
            const overrides = permissionOverrides[member.id];
            const effective = getEffectivePermissionsForRole(member.role as UserRole, overrides);
            const roleLabel = ROLE_LABELS[member.role as UserRole] ?? member.role;

            return (
              <tr key={member.id}>
                <td className="sticky left-0 z-10 bg-white px-3 py-2">
                  <p className="font-medium text-slate-900">
                    {member.profiles?.full_name ?? "Usuario"}
                  </p>
                  <p className="text-xs text-slate-500">{member.profiles?.email}</p>
                </td>
                <td className="px-2 py-2 text-xs text-slate-600">{roleLabel}</td>
                {MANAGEABLE_PERMISSION_KEYS.map((permission) => {
                  const checked = effective[permission];
                  const actionId = `${member.id}-${permission}`;
                  const hasOverride = overrides?.[permission] !== undefined;

                  return (
                    <td key={permission} className="px-2 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={acting === actionId}
                        aria-label={`${MANAGEABLE_PERMISSION_LABELS[permission]} para ${member.profiles?.full_name ?? "usuario"}`}
                        className={cn(
                          "h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500",
                          hasOverride && "ring-2 ring-amber-300 ring-offset-1"
                        )}
                        title={
                          hasOverride
                            ? "Permiso personalizado (distinto al rol por defecto)"
                            : "Según rol por defecto"
                        }
                        onChange={(e) =>
                          void togglePermission(member, permission, e.target.checked)
                        }
                      />
                    </td>
                  );
                })}
                <td className="px-2 py-2 text-center">
                  <input
                    type="checkbox"
                    checked={member.uses_shared_ai}
                    disabled={!hasSharedCredentials || acting === `${member.id}-shared-ai`}
                    aria-label={`Credenciales compartidas para ${member.profiles?.full_name ?? "usuario"}`}
                    title={
                      hasSharedCredentials
                        ? "Usar credenciales de IA del consultorio"
                        : "Configurá credenciales compartidas arriba"
                    }
                    className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                    onChange={(e) => void toggleSharedAi(member, e.target.checked)}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="border-t border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-500">
        Los recuadros con borde ámbar indican un permiso personalizado. El administrador siempre
        tiene acceso total y usa credenciales propias.
      </p>
    </div>
  );
}
