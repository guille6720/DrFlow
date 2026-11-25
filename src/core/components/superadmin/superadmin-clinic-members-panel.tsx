"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  deactivateClinicMemberLifecycle,
  permanentlyDeleteClinicUserLifecycle,
  reactivateClinicMemberLifecycle,
  unlinkClinicMemberLifecycle,
} from "@/lib/actions/user-lifecycle";

export type SuperadminClinicMemberRow = {
  id: string;
  role: string;
  is_active: boolean | null;
  user_id: string;
  profiles: { full_name: string; email: string } | { full_name: string; email: string }[] | null;
};

function profileOf(m: SuperadminClinicMemberRow) {
  const p = m.profiles;
  if (!p) return { full_name: "Sin nombre", email: "" };
  return Array.isArray(p) ? p[0] ?? { full_name: "Sin nombre", email: "" } : p;
}

type Props = {
  clinicId: string;
  members: SuperadminClinicMemberRow[];
};

export function SuperadminClinicMembersPanel({ clinicId, members }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [acting, setActing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SuperadminClinicMemberRow | null>(null);
  const [confirmEmail, setConfirmEmail] = useState("");

  function run(
    key: string,
    action: () => Promise<{ error?: string; message?: string; success?: boolean }>
  ) {
    setActing(key);
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await action();
      setActing(null);
      if (result.error) {
        setError(result.error);
        return;
      }
      setMessage(result.message ?? "Listo.");
      setDeleteTarget(null);
      setConfirmEmail("");
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">
        Desactivar suspende el login. Reactivar lo rehabilita. Desvincular quita el acceso a esta
        clínica sin borrar la cuenta. Eliminar definitivamente borra Auth y libera el email; la
        ficha profesional y la historia clínica se conservan.
      </p>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}
      {message ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          {message}
        </div>
      ) : null}

      {members.length === 0 ? (
        <p className="text-sm text-slate-500">Sin miembros en esta clínica.</p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
          {members.map((m) => {
            const profile = profileOf(m);
            const active = m.is_active !== false;
            return (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-3">
                <div>
                  <p className="font-medium text-slate-900">{profile.full_name}</p>
                  <p className="text-xs text-slate-600">
                    {profile.email} · {m.role} · {active ? "activo" : "desactivado"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {active ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      loading={acting === `${m.id}-deactivate`}
                      onClick={() =>
                        run(`${m.id}-deactivate`, () =>
                          deactivateClinicMemberLifecycle(m.id, clinicId)
                        )
                      }
                    >
                      Desactivar
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      loading={acting === `${m.id}-reactivate`}
                      onClick={() =>
                        run(`${m.id}-reactivate`, () =>
                          reactivateClinicMemberLifecycle(m.id, clinicId)
                        )
                      }
                    >
                      Reactivar
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    loading={acting === `${m.id}-unlink`}
                    onClick={() => {
                      if (
                        !confirm(
                          `¿Desvincular a ${profile.full_name} de esta clínica?\nNo se borra la cuenta Auth ni la historia clínica.`
                        )
                      ) {
                        return;
                      }
                      run(`${m.id}-unlink`, () => unlinkClinicMemberLifecycle(m.id, clinicId));
                    }}
                  >
                    Desvincular de clínica
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="border-red-200 text-red-700 hover:bg-red-50"
                    disabled={pending}
                    onClick={() => {
                      setDeleteTarget(m);
                      setConfirmEmail("");
                      setError(null);
                    }}
                  >
                    Eliminar definitivamente
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {deleteTarget ? (
        <div className="rounded-lg border border-red-200 bg-red-50/70 p-4">
          <h4 className="text-sm font-semibold text-red-950">Confirmar eliminación definitiva</h4>
          <p className="mt-2 text-sm text-red-900">
            Se eliminará la cuenta de acceso de{" "}
            <strong>{profileOf(deleteTarget).full_name}</strong> (
            {profileOf(deleteTarget).email}). Quedará libre el correo para un nuevo registro. La
            ficha profesional, historias clínicas y auditorías se conservan. No se eliminan
            pacientes ni datos de otros usuarios.
          </p>
          <div className="mt-3 max-w-md">
            <Input
              label="Escribí el email del usuario para confirmar"
              value={confirmEmail}
              onChange={(e) => setConfirmEmail(e.target.value)}
              placeholder={profileOf(deleteTarget).email}
              autoComplete="off"
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              className="bg-red-700 text-white hover:bg-red-800"
              disabled={pending}
              loading={acting === `${deleteTarget.id}-delete`}
              onClick={() =>
                run(`${deleteTarget.id}-delete`, () =>
                  permanentlyDeleteClinicUserLifecycle(deleteTarget.id, clinicId, confirmEmail)
                )
              }
            >
              Confirmar eliminación
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setDeleteTarget(null);
                setConfirmEmail("");
              }}
            >
              Cancelar
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
