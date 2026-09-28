"use client";

import { Check, ChevronDown, ChevronRight, Lock, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { MANAGEABLE_PERMISSION_LABELS } from "@/core/permissions/member-permissions";
import {
  codeDefault,
  EDITABLE_ROLES,
  type EditableRole,
  groupState,
  PERMISSION_GROUPS,
  roleEffective,
  type RolePermissionOverrides,
} from "@/core/permissions/role-permissions";
import { type ManageablePermissionKey, ROLE_LABELS } from "@/core/permissions/roles";

import { cn } from "@/shared/utils/cn";

import {
  resetClinicRolePermissions,
  updateClinicRolePermissions,
} from "@/lib/actions/team-permissions";

type Props = {
  roleOverrides: RolePermissionOverrides;
  acting: string | null;
  onActingChange: (id: string | null) => void;
  onError: (message: string | null) => void;
};

function TriStateCheckbox({
  state,
  disabled,
  label,
  onChange,
}: {
  state: "all" | "none" | "some";
  disabled?: boolean;
  label: string;
  onChange: (next: boolean) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = state === "some";
  }, [state]);
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={state === "all"}
      disabled={disabled}
      aria-label={label}
      className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
      onChange={() => onChange(state !== "all")}
    />
  );
}

function LockedCheck() {
  return (
    <span
      className="inline-flex h-4 w-4 items-center justify-center rounded bg-slate-300 text-white"
      title="El administrador siempre tiene acceso total"
    >
      <Check className="h-3 w-3" strokeWidth={3} />
    </span>
  );
}

export function RolePermissionsMatrix({ roleOverrides, acting, onActingChange, onError }: Props) {
  const router = useRouter();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  async function apply(role: EditableRole, keys: ManageablePermissionKey[], granted: boolean, id: string) {
    onActingChange(id);
    onError(null);
    const result = await updateClinicRolePermissions(role, keys, granted);
    onActingChange(null);
    if (result.error) onError(result.error);
    else router.refresh();
  }

  async function reset(role: EditableRole) {
    const id = `reset-${role}`;
    onActingChange(id);
    onError(null);
    const result = await resetClinicRolePermissions(role);
    onActingChange(null);
    if (result.error) onError(result.error);
    else router.refresh();
  }

  const customized = (role: EditableRole) => Object.keys(roleOverrides[role] ?? {}).length > 0;

  return (
    <div className="drflow-card-light overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-slate-50">
          <tr className="border-b border-slate-200">
            <th className="px-3 py-3 font-semibold text-slate-800">Permiso</th>
            <th className="w-32 px-3 py-3 text-center font-semibold text-slate-800">
              <span className="inline-flex items-center gap-1">
                {ROLE_LABELS.clinic_admin}
                <Lock className="h-3 w-3 text-slate-400" aria-hidden />
              </span>
            </th>
            {EDITABLE_ROLES.map((role) => (
              <th key={role} className="w-32 px-3 py-3 text-center font-semibold text-slate-800">
                <div className="flex flex-col items-center gap-1">
                  <span>{ROLE_LABELS[role]}</span>
                  {customized(role) ? (
                    <button
                      type="button"
                      disabled={acting !== null}
                      onClick={() => void reset(role)}
                      className="inline-flex items-center gap-1 text-[11px] font-normal text-slate-500 hover:text-teal-700 disabled:opacity-50"
                      title="Volver a los permisos por defecto de la aplicación"
                    >
                      <RotateCcw className="h-3 w-3" aria-hidden />
                      Restablecer
                    </button>
                  ) : null}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white">
          {PERMISSION_GROUPS.map((group) => {
            const isCollapsed = collapsed[group.id] ?? false;
            return (
              <GroupRows
                key={group.id}
                group={group}
                isCollapsed={isCollapsed}
                onToggleCollapse={() =>
                  setCollapsed((prev) => ({ ...prev, [group.id]: !isCollapsed }))
                }
                roleOverrides={roleOverrides}
                acting={acting}
                onApply={apply}
              />
            );
          })}
        </tbody>
      </table>
      <p className="border-t border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-500">
        Los puntos ámbar marcan permisos distintos a los valores por defecto de la aplicación. Los
        cambios aplican a todos los miembros de ese rol en este consultorio.
      </p>
    </div>
  );
}

function GroupRows({
  group,
  isCollapsed,
  onToggleCollapse,
  roleOverrides,
  acting,
  onApply,
}: {
  group: (typeof PERMISSION_GROUPS)[number];
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  roleOverrides: RolePermissionOverrides;
  acting: string | null;
  onApply: (role: EditableRole, keys: ManageablePermissionKey[], granted: boolean, id: string) => Promise<void>;
}) {
  return (
    <>
      <tr className="border-b border-slate-200 bg-slate-100/70">
        <td className="px-3 py-2">
          <button
            type="button"
            onClick={onToggleCollapse}
            className="inline-flex items-center gap-1 font-semibold text-slate-800"
            aria-expanded={!isCollapsed}
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" aria-hidden />
            ) : (
              <ChevronDown className="h-4 w-4" aria-hidden />
            )}
            {group.label}
          </button>
        </td>
        <td className="px-3 py-2 text-center">
          <LockedCheck />
        </td>
        {EDITABLE_ROLES.map((role) => {
          const id = `${role}-group-${group.id}`;
          return (
            <td key={role} className="px-3 py-2 text-center">
              <TriStateCheckbox
                state={groupState(role, group, roleOverrides)}
                disabled={acting !== null}
                label={`${group.label} completo para ${ROLE_LABELS[role]}`}
                onChange={(next) => void onApply(role, group.keys, next, id)}
              />
            </td>
          );
        })}
      </tr>
      {isCollapsed
        ? null
        : group.keys.map((key) => (
            <tr key={key} className="border-b border-slate-100">
              <td className="py-2 pl-9 pr-3 text-slate-700">{MANAGEABLE_PERMISSION_LABELS[key]}</td>
              <td className="px-3 py-2 text-center">
                <LockedCheck />
              </td>
              {EDITABLE_ROLES.map((role) => {
                const checked = roleEffective(role, key, roleOverrides);
                const differs = checked !== codeDefault(role, key);
                const id = `${role}-${key}`;
                return (
                  <td key={role} className="px-3 py-2 text-center">
                    <span className="relative inline-flex">
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={acting !== null}
                        aria-label={`${MANAGEABLE_PERMISSION_LABELS[key]} para ${ROLE_LABELS[role]}`}
                        className={cn("h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500")}
                        title={differs ? "Distinto al valor por defecto" : "Valor por defecto"}
                        onChange={(e) => void onApply(role, [key], e.target.checked, id)}
                      />
                      {differs ? (
                        <span className="absolute -right-1.5 -top-1.5 h-2 w-2 rounded-full bg-amber-400" />
                      ) : null}
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
    </>
  );
}
