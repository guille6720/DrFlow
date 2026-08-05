"use client";

import type { EmailOtpType } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { createClient } from "@/core/supabase/client";

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("TIMEOUT")), ms);
    promise.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      }
    );
  });
}

export function useRestablecerPassword() {
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
        const tokenHash = params.get("token_hash");
        const type = (params.get("type") ?? hashParams.get("type")) as EmailOtpType | null;
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");

        if (tokenHash && type) {
          const { data, error: otpError } = await withTimeout(
            supabase.auth.verifyOtp({ type, token_hash: tokenHash }),
            12000
          );
          if (otpError) throw otpError;
          if (data.session) {
            await supabase.auth.setSession({
              access_token: data.session.access_token,
              refresh_token: data.session.refresh_token,
            });
          }
        } else if (code) {
          const { error: exchangeError } = await withTimeout(
            supabase.auth.exchangeCodeForSession(code),
            12000
          );
          if (exchangeError) throw exchangeError;
        } else if (accessToken && refreshToken) {
          const { error: setErrorSession } = await withTimeout(
            supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            }),
            12000
          );
          if (setErrorSession) throw setErrorSession;
        }

        const {
          data: { session },
          error: sessionError,
        } = await withTimeout(supabase.auth.getSession(), 8000);

        if (cancelled) return;

        if (sessionError || !session) {
          setError(
            "No pudimos validar el link. Pedí uno nuevo desde el login e abrilo en el mismo navegador (no en otra app)."
          );
          setLoading(false);
          return;
        }

        setReady(true);
        setLoading(false);
        window.history.replaceState({}, "", "/login/restablecer");
      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : "";
        setError(
          msg === "TIMEOUT"
            ? "La validación tardó demasiado. Pedí un link nuevo e intentá de nuevo."
            : msg.toLowerCase().includes("expired") || msg.toLowerCase().includes("otp")
              ? "El link expiró o ya fue usado. Pedí uno nuevo desde el login."
              : "No pudimos validar el link. Pedí uno nuevo desde el login."
        );
        setLoading(false);
      }
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setReady(true);
        setLoading(false);
        setError(null);
      }
    });

    void establishRecoverySession();

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

  return {
    ready,
    loading,
    saving,
    error,
    password,
    setPassword,
    confirm,
    setConfirm,
    handleSubmit,
  };
}
