"use client";

import { UserPlus } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { UserRole } from "@/types/database";

const INVITE_ROLES: { value: UserRole; label: string }[] = [
  { value: "doctor", label: "Médico" },
  { value: "secretary", label: "Secretaría / Recepción" },
  { value: "clinic_admin", label: "Administrador" },
];

function generatePassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$";
  let value = "";
  for (let i = 0; i < 12; i += 1) {
    value += chars[Math.floor(Math.random() * chars.length)];
  }
  return value;
}

export function TeamInviteFormSection({
  loading,
  onSubmit,
}: {
  loading: boolean;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
}) {
  const [password, setPassword] = useState("");

  return (
    <form
      onSubmit={onSubmit}
      className="drflow-card-light mb-6 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2"
    >
      <Input name="full_name" label="Nombre completo" required placeholder="Ej: Dra. Ana Martínez" />
      <Input name="email" label="Email (usuario de acceso)" type="email" required placeholder="usuario@email.com" />
      <Select
        name="role"
        label="Rol en el consultorio"
        required
        defaultValue="secretary"
        options={INVITE_ROLES.map((r) => ({ value: r.value, label: r.label }))}
      />
      <div className="space-y-2">
        <Input
          name="password"
          label="Contraseña inicial"
          type="text"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Mínimo 8 caracteres"
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setPassword(generatePassword())}
        >
          Generar contraseña
        </Button>
      </div>
      <div className="flex items-end sm:col-span-2">
        <Button type="submit" loading={loading}>
          <UserPlus className="h-4 w-4" />
          Invitar usuario
        </Button>
      </div>
      <p className="text-xs text-slate-600 sm:col-span-2">
        Se creará la cuenta con este email y contraseña, y se enviará un correo al invitado con los
        datos de acceso.
      </p>
    </form>
  );
}

export { INVITE_ROLES };
