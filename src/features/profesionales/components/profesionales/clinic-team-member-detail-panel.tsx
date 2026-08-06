"use client";

import Link from "next/link";

import { INVITE_ROLES } from "@/features/configuracion/components/configuracion/team-invite-form-section";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { EnrichedTeamMember } from "@/lib/utils/team-member-display";
import type { UserRole } from "@/types/database";

type Props = {
  member: EnrichedTeamMember;
  acting: string | null;
  loading: boolean;
  error: string | null;
  success: string | null;
  onSubmitProfile: (e: React.FormEvent<HTMLFormElement>) => void;
  onRoleChange: (role: UserRole) => void;
  onDeactivate: () => void;
  onRemove: () => void;
};

export function ClinicTeamMemberDetailPanel({
  member,
  acting,
  loading,
  error,
  success,
  onSubmitProfile,
  onRoleChange,
  onDeactivate,
  onRemove,
}: Props) {
  return (
    <Card title="Usuario del consultorio">
      <p className="mb-4 text-sm text-slate-700">
        Editá los datos de acceso, cambiá el rol o suspendé/eliminá el uso de la app para este
        usuario.
      </p>

      {error ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          {success}
        </div>
      ) : null}

      <form onSubmit={onSubmitProfile} className="space-y-4">
        <Input
          name="full_name"
          label="Nombre completo"
          required
          defaultValue={member.display_name}
        />
        <Input
          label="Email (usuario de acceso)"
          value={member.display_email ?? ""}
          readOnly
          disabled
        />
        <div className="flex flex-wrap items-end gap-2">
          <Select
            label="Rol en el consultorio"
            value={member.role}
            onChange={(e) => onRoleChange(e.target.value as UserRole)}
            options={INVITE_ROLES.map((r) => ({ value: r.value, label: r.label }))}
            className="min-w-[180px]"
          />
          <Button type="submit" loading={loading}>
            Guardar nombre
          </Button>
        </div>
      </form>

      <div className="mt-6 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
        {member.role === "doctor" && member.professional_id ? (
          <Link href={`/ingreso-profesionales?id=${member.professional_id}`}>
            <Button type="button" variant="outline">
              Ver ficha profesional
            </Button>
          </Link>
        ) : member.role === "doctor" ? (
          <Link href="/ingreso-profesionales?nuevo=1">
            <Button type="button" variant="outline">
              Crear ficha profesional
            </Button>
          </Link>
        ) : null}
        <Link href="/configuracion?grupo=consultorio&seccion=equipo">
          <Button type="button" variant="outline">
            Invitar otro usuario
          </Button>
        </Link>
        <Button
          type="button"
          variant="outline"
          loading={acting === `${member.id}-deactivate`}
          onClick={onDeactivate}
        >
          Desactivar acceso
        </Button>
        <Button
          type="button"
          variant="outline"
          className="border-red-200 text-red-700 hover:bg-red-50"
          loading={acting === `${member.id}-remove`}
          onClick={onRemove}
        >
          Eliminar cuenta
        </Button>
      </div>
    </Card>
  );
}
