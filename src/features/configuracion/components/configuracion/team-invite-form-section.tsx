"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { UserPlus } from "lucide-react";
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
      <Input name="full_name" label="Nombre completo" required placeholder="Ej: Dra. Ana Martínez" />
      <Input name="email" label="Email" type="email" required placeholder="usuario@email.com" />
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
    </form>
  );
}

export { INVITE_ROLES };
