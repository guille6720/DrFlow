"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Activity, AlertCircle, CheckCircle2 } from "lucide-react";

function readPasswordLeakFromUrl(): { email: string; error: string } | null {
  if (typeof window === "undefined") return null;
  const url = new URL(window.location.href);
  if (!url.searchParams.has("password")) return null;

  const email = url.searchParams.get("email") ?? "";
  url.searchParams.delete("email");
  url.searchParams.delete("password");
  window.history.replaceState({}, "", url.pathname + url.search);

  return {
    email,
    error: "Volvé a ingresar tu contraseña en el formulario.",
  };
}

function LoginForm() {
  const searchParams = useSearchParams();
  const bootstrap = useMemo(() => {
    const leak = readPasswordLeakFromUrl();
    return {
      email: leak?.email || searchParams.get("email") || "",
      passwordLeakError: leak?.error ?? null,
    };
    // Solo al montar: limpiar URL con password y fijar email inicial
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [email, setEmail] = useState(bootstrap.email);
  const [loading, setLoading] = useState(false);

  const { formError, info } = useMemo(() => {
    if (bootstrap.passwordLeakError) {
      return { formError: bootstrap.passwordLeakError, info: null as string | null };
    }

    const emailParam = searchParams.get("email") ?? "";
    const errorParam = searchParams.get("error");
    const registered = searchParams.get("registered");

    let infoMessage: string | null = null;

    if (registered === "pending") {
      infoMessage =
        "¡Cuenta creada! Confirmá tu email en Supabase (Authentication → Users → Confirm user) y luego ingresá acá.";
    } else if (registered === "1") {
      infoMessage = "Registro exitoso. Ingresá con tu email y contraseña.";
    } else if (searchParams.get("invited") === "1") {
      infoMessage =
        "¡Bienvenido! Si recibiste invitación, abrí el link del email para elegir tu contraseña.";
    } else if (searchParams.get("reset") === "sent") {
      infoMessage = `Si ${emailParam || "tu email"} está registrado, te enviamos un link para restablecer la contraseña. Revisá la bandeja y spam.`;
    } else if (searchParams.get("reset") === "done") {
      infoMessage = "Contraseña actualizada. Ingresá con tu nueva contraseña.";
    }

    return {
      formError: errorParam
        ? decodeURIComponent(errorParam).includes("access_denied") ||
          decodeURIComponent(errorParam).toLowerCase() === "access denied"
          ? "El link de recuperación expiró o no es válido. Pedí uno nuevo abajo."
          : decodeURIComponent(errorParam)
        : null,
      info: infoMessage,
    };
  }, [bootstrap.passwordLeakError, searchParams]);

  return (
    <div className="flex min-h-screen">
      <div className="hidden w-1/2 flex-col justify-between bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 p-12 text-white lg:flex">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 p-3 shadow-lg">
            <Activity className="h-8 w-8" />
          </div>
          <span className="text-2xl font-bold">DrFlow</span>
        </div>
        <div>
          <h1 className="text-4xl font-bold leading-tight">
            Gestión clínica simple, segura y profesional
          </h1>
          <p className="mt-4 text-lg text-blue-100">
            Turnos, pacientes, historias clínicas y reportes en una sola plataforma.
          </p>
        </div>
        <p className="text-sm text-blue-300/80">© DrFlow — Software médico SaaS</p>
      </div>

      <div className="flex flex-1 items-center justify-center bg-gradient-to-br from-blue-50/50 to-white p-6">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <div className="flex items-center gap-2 text-blue-800">
              <Activity className="h-6 w-6" />
              <span className="text-xl font-bold">DrFlow</span>
            </div>
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
            {info && (
              <div
                role="status"
                className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900"
              >
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{info}</span>
              </div>
            )}
            {formError && (
              <div
                role="alert"
                className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
              >
                <div className="flex items-start gap-2">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{formError}</span>
                </div>
                {formError.includes("no está registrado") && (
                  <p className="pl-6 text-xs text-red-700">
                    <Link href="/register" className="font-medium underline">
                      Ir a registrar clínica
                    </Link>
                  </p>
                )}
                {(formError.includes("contraseña") ||
                  formError.includes("confirmado") ||
                  formError.includes("No pudimos iniciar sesión")) && (
                  <p className="pl-6 text-xs text-red-700">
                    El botón de abajo es opcional: solo si querés recibir un email para elegir una
                    nueva contraseña.
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
              minLength={6}
              autoComplete="current-password"
            />
            <Button type="submit" className="w-full" loading={loading}>
              Ingresar
            </Button>
          </form>

          <form action="/api/auth/signout" method="post" className="mt-3 text-center">
            <button
              type="submit"
              className="text-xs text-slate-500 underline hover:text-slate-700"
            >
              Cerrar sesión e ingresar con otra cuenta
            </button>
          </form>

          <form
            action="/api/auth/reset-password"
            method="post"
            className="mt-4 border-t border-slate-100 pt-4"
          >
            <p className="mb-2 text-xs text-slate-500">
              ¿Olvidaste tu contraseña o el registro no terminó?
            </p>
            <input type="hidden" name="email" value={email} />
            <Button type="submit" variant="outline" className="w-full" size="sm">
              Enviar link para restablecer contraseña
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
