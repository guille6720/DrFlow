"use client";

import { AlertCircle, CheckCircle2 } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";

import { LoginBrandPanel } from "@/core/components/auth/login-brand-panel";
import { LoginSubmitButton } from "@/core/components/auth/login-submit-button";
import { DrFlowLogo } from "@/core/components/brand/drflow-logo";
import { useLoginForm } from "@/core/hooks/use-login-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const GoogleLoginButton = dynamic(
  () =>
    import("@/core/components/auth/google-login-button").then((m) => m.GoogleLoginButton),
  { ssr: false, loading: () => null }
);

export function LoginFormView() {
  const {
    email,
    setEmail,
    hasActiveSession,
    resetLoading,
    resetMessage,
    resetError,
    formError,
    info,
    isInvitedFlow,
    handleResetPassword,
  } = useLoginForm();

  return (
    <div className="drflow-auth-page flex min-h-[100dvh]">
      <LoginBrandPanel />

      <main
        id="main-content"
        className="flex flex-1 items-center justify-center bg-[#eef2f6] px-4 py-10 sm:px-6"
      >
        <div className="drflow-auth-surface w-full max-w-[420px] rounded-2xl border border-slate-200/80 p-6 shadow-[0_18px_50px_-24px_rgb(15_23_42_/_0.35)] sm:p-8">
          <div className="mb-6 flex justify-center">
            <DrFlowLogo size="lg" href="/" centered withTagline />
          </div>

          <div className="text-center sm:text-left">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">Iniciar sesión</h2>
            {isInvitedFlow ? (
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Te invitaron al consultorio. Ingresá con el email y la contraseña del mail, o{" "}
                <Link
                  href="/acceso-invitado"
                  className="font-semibold text-teal-700 underline-offset-2 hover:underline"
                >
                  mirá tus credenciales
                </Link>
                .
              </p>
            ) : (
              <p className="mt-2 text-sm text-slate-600">
                ¿No tenés cuenta?{" "}
                <Link
                  href="/register"
                  className="font-semibold text-teal-700 underline-offset-2 hover:underline"
                >
                  Registrar clínica
                </Link>
              </p>
            )}
          </div>

          <form action="/api/auth/login" method="post" className="mt-7 space-y-4">
            {(info || resetMessage) && (
              <div
                role="status"
                className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-sm text-emerald-900"
              >
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <span>{resetMessage ?? info}</span>
              </div>
            )}
            {(formError || resetError) && (
              <div
                role="alert"
                className="space-y-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-900"
              >
                <div className="flex items-start gap-2">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                  <span className="leading-relaxed">{resetError ?? formError}</span>
                </div>
                {formError?.includes("no está registrado") && (
                  <p className="pl-6 text-xs text-red-800">
                    <Link href="/register" className="font-semibold underline underline-offset-2">
                      Ir a registrar clínica
                    </Link>
                  </p>
                )}
              </div>
            )}
            <Input
              name="email"
              label="Email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
            />
            <Input
              name="password"
              label="Contraseña"
              type="password"
              required
              minLength={8}
              autoComplete="current-password"
              placeholder="••••••••"
            />
            <LoginSubmitButton />
          </form>

          {!isInvitedFlow ? (
            <>
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200" />
                </div>
                <div className="relative flex justify-center text-xs font-medium uppercase tracking-wide">
                  <span className="bg-white px-3 text-slate-500">o</span>
                </div>
              </div>
              <GoogleLoginButton />
            </>
          ) : (
            <p className="mt-5 rounded-xl border border-teal-200 bg-teal-50 px-3.5 py-3 text-sm leading-relaxed text-teal-950">
              Tu acceso se creó con email y contraseña. No uses Google: ingresá con los datos del
              mail de invitación.
            </p>
          )}

          {hasActiveSession ? (
            <form action="/api/auth/signout" method="post" className="mt-4 text-center">
              <button
                type="submit"
                className="text-xs font-medium text-slate-600 underline underline-offset-2 hover:text-slate-900"
              >
                Cerrar sesión e ingresar con otra cuenta
              </button>
            </form>
          ) : null}

          <div className="mt-6 border-t border-slate-100 pt-5">
            <p className="mb-3 text-xs leading-relaxed text-slate-600">
              ¿Olvidaste tu contraseña? Escribí tu email arriba y pedí un link de restablecimiento.
            </p>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              size="sm"
              loading={resetLoading}
              onClick={handleResetPassword}
            >
              Enviar link para restablecer contraseña
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
