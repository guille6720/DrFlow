"use client";

import { ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { FeatureGate } from "@/core/components/entitlements/feature-gate";
import { FEATURES } from "@/core/entitlements/features";
import type { ManageablePermissionKey } from "@/core/permissions/member-permissions";
import type { RolePermissionOverrides } from "@/core/permissions/role-permissions";

import { RolePermissionsMatrix } from "@/features/configuracion/components/configuracion/role-permissions-matrix";
import { TeamPermissionsMatrix } from "@/features/configuracion/components/configuracion/team-permissions-matrix";
import { TeamSharedCredentialsPanel } from "@/features/configuracion/components/configuracion/team-shared-credentials-panel";

import { Card } from "@/components/ui/card";
import type { TeamPermissionMember } from "@/lib/actions/team-permissions";

type Props = {
  members: TeamPermissionMember[];
  permissionOverrides: Record<string, Partial<Record<ManageablePermissionKey, boolean>>>;
  roleOverrides: RolePermissionOverrides;
  hasSharedCredentials: boolean;
};

export function TeamAccessPanel({
  members,
  permissionOverrides,
  roleOverrides,
  hasSharedCredentials,
}: Props) {
  const router = useRouter();
  const [acting, setActing] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function handleError(message: string | null) {
    setErr(message);
    if (message) router.refresh();
  }

  const errorBox = err ? (
    <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
      {err}
    </div>
  ) : null;

  return (
    <div id="permisos-equipo" className="space-y-6">
      <FeatureGate feature={FEATURES.AI}>
        <TeamSharedCredentialsPanel />
      </FeatureGate>

      <Card title="Permisos por rol">
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-slate-600" />
          <p className="text-sm text-slate-700">
            Definí qué puede hacer cada rol en este consultorio. Marcá un módulo completo o permisos
            individuales. Los cambios aplican al menú, rutas y acciones de todos los miembros con
            ese rol.
          </p>
        </div>
        {errorBox}
        <RolePermissionsMatrix
          roleOverrides={roleOverrides}
          acting={acting}
          onActingChange={setActing}
          onError={handleError}
        />
      </Card>

      <Card title="Excepciones por usuario">
        <p className="mb-4 text-sm text-slate-600">
          Si un miembro necesita algo distinto a su rol, ajustalo acá. Las excepciones tienen
          prioridad sobre la configuración del rol.
        </p>
        <TeamPermissionsMatrix
          members={members}
          permissionOverrides={permissionOverrides}
          roleOverrides={roleOverrides}
          hasSharedCredentials={hasSharedCredentials}
          acting={acting}
          onActingChange={setActing}
          onError={handleError}
        />
      </Card>
    </div>
  );
}
