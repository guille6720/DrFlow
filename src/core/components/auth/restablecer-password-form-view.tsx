"use client";

import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import Link from "next/link";

import { DrFlowLogo } from "@/core/components/brand/drflow-logo";
import { useRestablecerPassword } from "@/core/hooks/use-restablecer-password";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function RestablecerPasswordFormView() {
  const {
    ready,
    loading,
    saving,
    error,
    password,
    setPassword,
    confirm,
    setConfirm,
    handleSubmit,
  } = useRestablecerPassword();

  return (
    <div className="flex min-h-screen">
      <div className="hidden w-1/2 flex-col justify-between bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 p-12 text-white lg:flex">
        <div className="flex w-full justify-center pt-2">
          <DrFlowLogo size="xl" href="/" />
        </div>
        <div>
          <h1 className="text-4xl font-bold leading-tight">Nueva contraseña</h1>
          <p className="mt-4 text-lg text-blue-100">
            Elegí una contraseña segura para tu cuenta.
          </p>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center bg-gradient-to-br from-blue-50/50 to-white p-6">
        <div className="w-full max-w-md">
          <h2 className="text-2xl font-bold text-slate-900">Restablecer contraseña</h2>

          {loading && (
            <div className="mt-8 space-y-2">
              <div className="flex items-center gap-2 text-slate-500">
                <Loader2 className="h-5 w-5 animate-spin" />
                Validando link…
              </div>
              <p className="text-xs text-slate-400">
                Si tarda más de 15 segundos, pedí un link nuevo desde el login.
              </p>
            </div>
          )}

          {error && !loading && (
            <div className="mt-6 space-y-4">
              <div
                role="alert"
                className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
              <Link href="/login" className="text-sm font-medium text-blue-700 hover:underline">
                Volver al login y pedir nuevo link
              </Link>
            </div>
          )}

          {ready && !loading && (
            <form onSubmit={handleSubmit} className="mt-8 space-y-4">
              <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                <span>Link verificado. Ingresá tu nueva contraseña.</span>
              </div>
              <Input
                label="Nueva contraseña"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <Input
                label="Confirmar contraseña"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
              <Button type="submit" className="w-full" loading={saving}>
                Guardar contraseña
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
