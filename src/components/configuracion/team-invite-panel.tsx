"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  deactivateClinicMember,
  inviteClinicMember,
  revokeClinicInvitation,
  updateClinicMemberRole,
} from "@/lib/actions/invitations";
import { ROLE_LABELS } from "@/lib/permissions/roles";
import type { UserRole } from "@/types/database";
import { Mail, UserPlus, X } from "lucide-react";

interface Member {
  id: string;
  role: string;
  is_active?: boolean;
  profiles?: { full_name: string; email: string } | null;
}

interface Invitation {
  id: string;
  email: string;
  full_name: string;
  role: string;
  status: string;
  created_at: string;
}

interface Props {
  members: Member[];
  invitations: Invitation[];
}

const INVITE_ROLES: { value: UserRole; label: string }[] = [
  { value: "doctor", label: "Médico" },
  { value: "secretary", label: "Secretaría / Recepción" },
  { value: "clinic_admin", label: "Administrador" },
];

export function TeamInvitePanel({ members, invitations }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);

  async function handleInvite(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    setErr(null);
    const result = await inviteClinicMember(new FormData(e.currentTarget));
    setLoading(false);
    if (result.error) setErr(result.error);
    else {
      setMsg(result.message ?? "Invitación enviada.");
      e.currentTarget.reset();
      router.refresh();
    }
  }

  async function runAction(id: string, action: () => Promise<{ error?: string }>) {
    setActing(id);
    setErr(null);
    const result = await action();
    setActing(null);
    if (result.error) setErr(result.error);
    else router.refresh();
  }

  const pending = invitations.filter((i) => i.status === "pending");
  const activeMembers = members.filter((m) => m.is_active !== false);

  return (
    <Card title="Equipo e invitaciones">
      <p className="mb-4 text-sm text-slate-600">
        Invitá médicos o secretaría por email. Si ya tienen cuenta en DrFlow, se agregan al instante.
        Si no, reciben un link para crear contraseña e ingresar.
      </p>

      {msg && (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          {msg}
        </div>
      )}
      {err && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {err}
        </div>
      )}

      <form onSubmit={handleInvite} className="mb-6 grid gap-3 rounded-xl border border-slate-200 bg-slate-50/50 p-4 sm:grid-cols-2">
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

      <div className="mb-6">
        <h4 className="mb-2 text-sm font-semibold text-slate-800">Usuarios activos</h4>
        {activeMembers.length === 0 ? (
          <p className="text-sm text-slate-500">Sin miembros en el equipo.</p>
        ) : (
          <ul className="space-y-2">
            {activeMembers.map((m) => (
              <li
                key={m.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm"
              >
                <div>
                  <p className="font-medium text-slate-900">
                    {m.profiles?.full_name ?? "Usuario"}
                  </p>
                  <p className="text-xs text-slate-500">{m.profiles?.email}</p>
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
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    loading={acting === m.id}
                    onClick={() =>
                      runAction(m.id, () => deactivateClinicMember(m.id))
                    }
                  >
                    Desactivar
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {pending.length > 0 && (
        <div>
          <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-800">
            <Mail className="h-4 w-4" />
            Invitaciones pendientes
          </h4>
          <ul className="space-y-2">
            {pending.map((inv) => (
              <li
                key={inv.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-100 bg-amber-50/50 px-3 py-2 text-sm"
              >
                <div>
                  <p className="font-medium text-slate-900">{inv.full_name}</p>
                  <p className="text-xs text-slate-600">
                    {inv.email} · {ROLE_LABELS[inv.role as UserRole] ?? inv.role}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  loading={acting === inv.id}
                  onClick={() => runAction(inv.id, () => revokeClinicInvitation(inv.id))}
                >
                  <X className="h-3.5 w-3.5" />
                  Cancelar
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
