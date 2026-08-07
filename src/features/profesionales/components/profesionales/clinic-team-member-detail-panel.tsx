"use client";

import { Mail } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { CopyCredentialsLinkButton } from "@/features/configuracion/components/configuracion/copy-credentials-link-button";
import { INVITE_ROLES } from "@/features/configuracion/components/configuracion/team-invite-form-section";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { generateInitialPassword } from "@/lib/utils/generate-initial-password";
import { invitationCredentialsPath } from "@/lib/utils/invitation-credentials-path";
import type { EnrichedTeamMember } from "@/lib/utils/team-member-display";
import type { UserRole } from "@/types/database";

function generatePassword(): string {
  return generateInitialPassword();
}

type Props = {
  member: EnrichedTeamMember;
  acting: string | null;
  loading: boolean;
  passwordLoading: boolean;
  resendLoading: boolean;
  error: string | null;
  success: string | null;
  onSubmitProfile: (e: React.FormEvent<HTMLFormElement>) => void;
  onSubmitPassword: (e: React.FormEvent<HTMLFormElement>) => void;
  onResendInviteEmail: () => void;
  onRoleChange: (role: UserRole) => void;
  onDeactivate: () => void;
  onRemove: () => void;
};

export function ClinicTeamMemberDetailPanel({
  member,
  acting,
  loading,
  passwordLoading,
  resendLoading,
  error,
  success,
  onSubmitProfile,
  onSubmitPassword,
  onResendInviteEmail,
  onRoleChange,
  onDeactivate,
  onRemove,
}: Props) {
  const [newPassword, setNewPassword] = useState("");

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

      <div className="mb-6 rounded-xl border border-indigo-100 bg-indigo-50/60 p-4">
        <h4 className="text-sm font-semibold text-indigo-950">Acceso del invitado</h4>
        <p className="mt-1 text-xs text-indigo-900/80">
          Compartí este enlace para que vea su usuario y contraseña. Vos no necesitás enviarle los
          datos manualmente.
        </p>
        {member.invitation_id ? (
          <div className="mt-3">
            <CopyCredentialsLinkButton path={invitationCredentialsPath(member.invitation_id)} />
          </div>
        ) : (
          <p className="mt-2 text-xs text-amber-800">
            No hay enlace de credenciales para este usuario. Restablecé la contraseña abajo para
            generar una nueva.
          </p>
        )}
        <div className="mt-4">
          <Button
            type="button"
            variant="outline"
            size="sm"
            loading={resendLoading}
            disabled={!member.initial_password}
            onClick={onResendInviteEmail}
          >
            <Mail className="h-4 w-4" />
            Reenviar mail con credenciales
          </Button>
        </div>
      </div>

      <form onSubmit={onSubmitProfile} className="space-y-4">
        <Input
          name="full_name"
          label="Nombre completo"
          required
          defaultValue={member.display_name}
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

      <form onSubmit={onSubmitPassword} className="mt-6 space-y-3 border-t border-slate-100 pt-4">
        <h4 className="text-sm font-semibold text-slate-800">Restablecer contraseña de acceso</h4>
        <div className="flex flex-wrap items-end gap-2">
          <Input
            name="password"
            label="Nueva contraseña"
            type="text"
            required
            minLength={8}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Mínimo 8 caracteres"
            className="min-w-[220px] flex-1"
          />
          <Button type="button" size="sm" variant="outline" onClick={() => setNewPassword(generatePassword())}>
            Generar
          </Button>
          <Button type="submit" loading={passwordLoading}>
            Guardar contraseña
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
