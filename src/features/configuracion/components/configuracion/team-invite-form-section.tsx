"use client";

import { UserPlus } from "lucide-react";

import { PlanCapHint } from "@/core/components/entitlements/plan-cap-hint";
import { FEATURES } from "@/core/entitlements/features";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { UserRole } from "@/types/database";

const INVITE_ROLES: { value: UserRole; label: string }[] = [
  { value: "doctor", label: "Médico" },
  { value: "secretary", label: "Secretaría / Recepción" },
  { value: "clinic_admin", label: "Administrador" },
];

export function TeamInviteFormSection({
  loading,
  onSubmit,
}: {
  loading: boolean;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form
      onSubmit={onSubmit}
      className="drflow-card-light mb-6 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2"
    >
      <div className="sm:col-span-2">
        <PlanCapHint feature={FEATURES.USERS_MAX} />
      </div>
      <Input name="full_name" label="Nombre completo" required placeholder="Ej: Dra. Ana Martínez" />
      <Input name="email" label="Email (usuario de acceso)" type="email" required placeholder="usuario@email.com" />
      <Select
        name="role"
        label="Rol en el consultorio"
        required
        defaultValue="secretary"
        options={INVITE_ROLES.map((r) => ({ value: r.value, label: r.label }))}
      />
      <div className="flex items-end sm:col-span-2">
        <Button type="submit" loading={loading}>
          <UserPlus className="h-4 w-4" />
          Invitar usuario
        </Button>
      </div>
      <p className="text-xs text-slate-600 sm:col-span-2">
        Se creará la cuenta automáticamente. Compartí el enlace de credenciales con la persona
        invitada para que vea su usuario y contraseña. Si el correo está configurado, también
        intentamos enviárselos por email.
      </p>
    </form>
  );
}

export { INVITE_ROLES };
