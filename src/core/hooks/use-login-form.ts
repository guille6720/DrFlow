"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/core/supabase/client";
import { resolveClientPublicSiteUrl } from "@/core/supabase/client-public-url";

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

export function useLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const bootstrap = useMemo(() => {
    const leak = readPasswordLeakFromUrl();
    return {
      email: leak?.email || searchParams.get("email") || "",
      passwordLeakError: leak?.error ?? null,
    };
  }, [searchParams]);
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

    const errorParam = searchParams.get("error");
    const registered = searchParams.get("registered");

    let infoMessage: string | null = null;

    if (registered === "pending") {
      infoMessage =
        "¡Cuenta creada! Te enviamos un email de confirmación. Revisá bandeja y spam, y después ingresá acá.";
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
      const siteUrl = resolveClientPublicSiteUrl();
      const redirectTo = `${siteUrl}/auth/confirm?next=${encodeURIComponent("/login/restablecer")}`;

      const { error } = await supabase.auth.resetPasswordForEmail(trimmed, {
        redirectTo,
      });

      if (error) {
        const msg = error.message.toLowerCase();
        if (msg.includes("redirect") || msg.includes("url")) {
          setResetError(
            "No pudimos generar el link. Probá de nuevo en unos minutos o contactá soporte."
          );
        } else if (msg.includes("rate")) {
          setResetError("Demasiados intentos. Esperá unos minutos.");
        } else {
          setResetError("No pudimos enviar el email. Revisá que el correo sea correcto.");
        }
        return;
      }

      setResetMessage(`Te enviamos un link a ${trimmed}. Abrilo desde tu correo (revisá spam).`);
      router.replace(`/login?reset=sent&email=${encodeURIComponent(trimmed)}`);
    } catch (e) {
      setResetError(e instanceof Error ? e.message : "No se pudo enviar el email.");
    } finally {
      setResetLoading(false);
    }
  }

  return {
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
  };
}
