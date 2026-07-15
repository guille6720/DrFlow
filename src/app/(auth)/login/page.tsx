"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DrFlowLogo } from "@/components/brand/drflow-logo";
import { GoogleLoginButton } from "@/components/auth/google-login-button";
import { createClient } from "@/lib/supabase/client";
import { AlertCircle, CheckCircle2 } from "lucide-react";

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
  const router = useRouter();
  const searchParams = useSearchParams();
  const bootstrap = useMemo(() => {
    const leak = readPasswordLeakFromUrl();
    return {
      email: leak?.email || searchParams.get("email") || "",
      passwordLeakError: leak?.error ?? null,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [email, setEmail] = useState(bootstrap.email);
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState<string | null>(
    searchParams.get("reset") === "sent"
      ? `Si ${searchParams.get("email") || "tu email"} está registrado, te enviamos un link. Revisá bandeja y spam.`
      : searchParams.get("reset") === "done"
        ? "Contraseña actualizada. Ingresá con tu nueva contraseña."
        : null
  );
  const [resetError, setResetError] = useState<string | null>(null);

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

  async function handleResetPassword() {
    setResetError(null);
    setResetMessage(null);

    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      setResetError("Ingresá tu email arriba para poder enviar el link.");
      return;
    }

    setResetLoading(true);
    try {
      const supabase = createClient();
      // Nunca mandar el mail a localhost: el link del email no abre en el celular / Gmail.
      // Preferir SITE_URL de producción; si no, vercel app público.
      const configured =
        (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "") ||
        "https://drflow-app-rho.vercel.app";
      const browserOrigin = window.location.origin.replace(/\/$/, "");
      const isLocal =
        browserOrigin.includes("localhost") || browserOrigin.includes("127.0.0.1");
      const siteUrl = isLocal ? configured : browserOrigin;
      const redirectTo = `${siteUrl}/auth/confirm?next=${encodeURIComponent("/login/restablecer")}`;

      const { error } = await supabase.auth.resetPasswordForEmail(trimmed, {
        redirectTo,
      });

      if (error) {
        const msg = error.message.toLowerCase();
        if (msg.includes("redirect") || msg.includes("url")) {
          setResetError(
            `URL no autorizada. En Supabase → Authentication → URL Configuration agregá: ${siteUrl}/auth/confirm`
          );
        } else if (msg.includes("rate")) {
          setResetError("Demasiados intentos. Esperá unos minutos.");
        } else {
          setResetError(error.message);
        }
        return;
      }

      setResetMessage(
        `Te enviamos un link a ${trimmed}. Abrilo en el navegador (el link va a ${siteUrl}). Revisá spam.`
      );
      router.replace(`/login?reset=sent&email=${encodeURIComponent(trimmed)}`);
    } catch (e) {
      setResetError(e instanceof Error ? e.message : "No se pudo enviar el email.");
    } finally {
      setResetLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen">
      <div className="hidden w-1/2 flex-col justify-between bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 p-12 text-white lg:flex">
        <div className="flex w-full justify-center pt-2">
          <DrFlowLogo size="xl" href="/" priority />
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
              minLength={6}
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
