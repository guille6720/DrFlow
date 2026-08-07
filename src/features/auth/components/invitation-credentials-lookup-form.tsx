"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { lookupInvitationCredentialsByEmail } from "@/lib/actions/invitation-credentials";

export function InvitationCredentialsLookupForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    const result = await lookupInvitationCredentialsByEmail(formData);
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    if (result.invitationId) {
      router.push(`/acceso-invitado/${result.invitationId}`);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-bold text-slate-900">Ver credenciales de invitación</h2>
      <p className="mt-2 text-sm text-slate-600">
        Si te invitaron al consultorio, ingresá el email con el que te dieron de alta para ver tu
        usuario y contraseña.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}
        <Input
          name="email"
          label="Email de acceso"
          type="email"
          required
          autoComplete="email"
          placeholder="usuario@email.com"
        />
        <Button type="submit" loading={loading} className="w-full">
          Ver mis credenciales
        </Button>
      </form>

      <p className="mt-4 text-center text-sm text-slate-500">
        ¿Ya tenés tus datos?{" "}
        <Link href="/login" className="font-medium text-blue-700 hover:underline">
          Iniciar sesión
        </Link>
      </p>
    </div>
  );
}
