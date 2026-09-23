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
    <div className="drflow-auth-page flex min-h-[100dvh]">
      <div className="drflow-auth-brand relative hidden w-[46%] flex-col justify-between overflow-hidden p-12 text-white lg:flex">
        <div className="relative z-10 flex w-full justify-start pt-1">
          <DrFlowLogo size="xl" href="/" variant="onDark" withTagline />
        </div>
        <div className="relative z-10 max-w-lg">
          <h1 className="text-4xl font-bold leading-tight tracking-tight text-white">
            Nueva contraseña
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-slate-200">
            Elegí una contraseña segura para tu cuenta.
          </p>
        </div>
        <p className="relative z-10 text-sm text-slate-300/90">© NexClinic — OpusOrg</p>
      </div>

      <div className="flex flex-1 items-center justify-center bg-[#eef2f6] px-4 py-10 sm:px-6">
        <div className="drflow-auth-surface w-full max-w-[420px] rounded-2xl border border-slate-200/80 p-6 shadow-[0_18px_50px_-24px_rgb(15_23_42_/_0.35)] sm:p-8">
          <div className="mb-6 flex justify-center lg:hidden">
            <DrFlowLogo size="lg" href="/" centered withTagline />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Restablecer contraseña</h2>

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
