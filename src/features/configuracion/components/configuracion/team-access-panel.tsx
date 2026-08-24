"use client";

import { ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { FeatureGate } from "@/core/components/entitlements/feature-gate";
import { FEATURES } from "@/core/entitlements/features";
import type { ManageablePermissionKey } from "@/core/permissions/member-permissions";

import { TeamPermissionsMatrix } from "@/features/configuracion/components/configuracion/team-permissions-matrix";
import { TeamSharedCredentialsPanel } from "@/features/configuracion/components/configuracion/team-shared-credentials-panel";

import { Card } from "@/components/ui/card";
import type { TeamPermissionMember } from "@/lib/actions/team-permissions";

type Props = {
  members: TeamPermissionMember[];
  permissionOverrides: Record<string, Partial<Record<ManageablePermissionKey, boolean>>>;
  hasSharedCredentials: boolean;
};

export function TeamAccessPanel({ members, permissionOverrides, hasSharedCredentials }: Props) {
  const router = useRouter();
  const [acting, setActing] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function handleError(message: string | null) {
    setErr(message);
    if (!message) router.refresh();
    else router.refresh();
  }

  return (
    <div id="permisos-equipo" className="space-y-6">
      <FeatureGate feature={FEATURES.AI}>
        <TeamSharedCredentialsPanel />
      </FeatureGate>

      <Card title="Permisos de acceso a recursos">
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-slate-600" />
          <p className="text-sm text-slate-700">
            Definí qué módulos puede usar cada miembro del equipo. Los permisos parten del rol
            (médico, secretaría) y podés ampliarlos o restringirlos caso por caso. Los cambios
            aplican al menú, rutas y acciones del consultorio.
          </p>
        </div>

        {err ? (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {err}
          </div>
        ) : null}

        <TeamPermissionsMatrix
          members={members}
          permissionOverrides={permissionOverrides}
          hasSharedCredentials={hasSharedCredentials}
          acting={acting}
          onActingChange={setActing}
          onError={handleError}
        />
      </Card>
    </div>
  );
}
