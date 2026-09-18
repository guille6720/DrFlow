"use client";

import { Check, Copy, Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { InvitationCredentialsView } from "@/lib/server/invitation-credentials";

type Props = {
  credentials: InvitationCredentialsView;
};

export function InvitationCredentialsViewPanel({ credentials }: Props) {
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState<"user" | "password" | null>(null);

  async function copyValue(value: string, kind: "user" | "password") {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    await navigator.clipboard.writeText(value);
    setCopied(kind);
    window.setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-bold text-slate-900">Tus credenciales de acceso</h2>
      <p className="mt-2 text-sm text-slate-600">
        Hola <strong>{credentials.full_name}</strong>
        {credentials.clinic_name ? (
          <>
            , este es tu acceso a <strong>{credentials.clinic_name}</strong> en NexClinic.
          </>
        ) : (
          ", este es tu acceso a NexClinic."
        )}
      </p>

      <dl className="mt-6 space-y-4">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Usuario</dt>
          <dd className="mt-1 flex items-center gap-2">
            <code className="flex-1 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-900">
              {credentials.email}
            </code>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void copyValue(credentials.email, "user")}
            >
              {copied === "user" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Contraseña</dt>
          <dd className="mt-1 flex items-center gap-2">
            <code className="flex-1 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-900">
              {showPassword ? credentials.initial_password : "••••••••••••"}
            </code>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void copyValue(credentials.initial_password, "password")}
            >
              {copied === "password" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </dd>
        </div>
      </dl>

      <p className="mt-4 text-xs text-slate-500">
        Guardá estos datos en un lugar seguro. Podés cambiar la contraseña después de iniciar sesión.
      </p>

      <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
        Iniciá sesión con el email y la contraseña de arriba. Las cuentas invitadas no pueden
        entrar con Google.
      </p>

      <Link
        href={`/login?email=${encodeURIComponent(credentials.email)}&invited=1`}
        className="mt-6 inline-flex"
      >
        <Button type="button">Ir a iniciar sesión</Button>
      </Link>
    </div>
  );
}
