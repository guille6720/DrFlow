"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { DrFlowLogo } from "@/components/brand/drflow-logo";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

function RestablecerForm() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    async function establishRecoverySession() {
      try {
        const params = new URLSearchParams(window.location.search);
        const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
        const code = params.get("code");
        const type = params.get("type") ?? hashParams.get("type");
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");

        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            if (!cancelled) {
              setError(
                "El link expiró o ya fue usado. Pedí un nuevo restablecimiento desde el login."
              );
              setLoading(false);
            }
            return;
          }
        } else if (accessToken && refreshToken) {
          const { error: setErrorSession } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (setErrorSession) {
            if (!cancelled) {
              setError(
                "No pudimos validar el link. Pedí un nuevo email de recuperación."
              );
              setLoading(false);
            }
            return;
          }
        }

        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (cancelled) return;

        if (sessionError || !session) {
          setError(
            type === "recovery" || hashParams.has("type")
              ? "No pudimos validar el link de recuperación. Pedí uno nuevo desde el login."
              : "No hay sesión de recuperación. Abrí el link del email (no copies solo la URL a mano) o pedí uno nuevo."
          );
          setLoading(false);
          return;
        }

        setReady(true);
        setLoading(false);
        window.history.replaceState({}, "", "/login/restablecer");
      } catch {
        if (!cancelled) {
          setError("Error al validar el link. Intentá de nuevo.");
          setLoading(false);
        }
      }
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setReady(true);
        setLoading(false);
        setError(null);
      }
    });

    establishRecoverySession();

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setSaving(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setSaving(false);
      setError(
        updateError.message.toLowerCase().includes("same password")
          ? "La nueva contraseña debe ser distinta a la anterior."
          : updateError.message
      );
      return;
    }

    await supabase.auth.signOut();
    router.push("/login?reset=done");
  }

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
            <div className="mt-8 flex items-center gap-2 text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin" />
              Validando link…
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

export default function RestablecerPasswordPage() {
  return (
    <Suspense fallback={null}>
      <RestablecerForm />
    </Suspense>
  );
}
