"use client";

import { AlertCircle, CheckCircle2 } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";

import { LoginBrandPanel } from "@/core/components/auth/login-brand-panel";
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
    loading,
    setLoading,
    resetLoading,
    resetMessage,
    resetError,
    formError,
    info,
    handleResetPassword,
  } = useLoginForm();

  return (
    <div className="flex min-h-screen">
      <LoginBrandPanel />

      <main id="main-content" className="flex flex-1 items-center justify-center bg-gradient-to-br from-blue-50/50 to-white p-6">
        <div className="w-full max-w-md">
          <div className="mb-8 flex justify-center lg:hidden">
            <DrFlowLogo size="lg" href="/" centered />
          </div>
          <h2 className="text-2xl font-bold text-slate-900">Iniciar sesión</h2>
          <p className="mt-1 text-sm text-slate-500">
            ¿No tenés cuenta?{" "}
            <Link href="/register" className="text-blue-700 hover:underline">
              Registrar clínica
            </Link>
          </p>

          <form
            action="/api/auth/login"
            method="post"
            onSubmit={() => setLoading(true)}
            className="mt-8 space-y-4"
          >
            {(info || resetMessage) && (
              <div
                role="status"
                className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900"
              >
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{resetMessage ?? info}</span>
              </div>
            )}
            {(formError || resetError) && (
              <div
                role="alert"
                className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
              >
                <div className="flex items-start gap-2">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{resetError ?? formError}</span>
                </div>
                {formError?.includes("no está registrado") && (
                  <p className="pl-6 text-xs text-red-700">
                    <Link href="/register" className="font-medium underline">
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
            />
            <Input
              name="password"
              label="Contraseña"
              type="password"
              required
              minLength={8}
              autoComplete="current-password"
            />
            <Button type="submit" className="w-full" loading={loading}>
              Ingresar
            </Button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-slate-400">o</span>
            </div>
          </div>

          <GoogleLoginButton />

          <form action="/api/auth/signout" method="post" className="mt-3 text-center">
            <button
              type="submit"
              className="text-xs text-slate-500 underline hover:text-slate-700"
            >
              Cerrar sesión e ingresar con otra cuenta
            </button>
          </form>

          <div className="mt-4 border-t border-slate-100 pt-4">
            <p className="mb-2 text-xs text-slate-500">
              ¿Olvidaste tu contraseña? Escribí tu email arriba y tocá el botón.
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
