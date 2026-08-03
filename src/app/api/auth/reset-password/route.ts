import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getPublicSiteUrl, getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env";
import { isSameOriginPost } from "@/lib/security/csrf";

/** 303 = forzar GET tras POST (evita HTTP 405 en /login). */
function redirectGet(url: URL | string) {
  return NextResponse.redirect(url, 303);
}

export async function POST(request: NextRequest) {
  const loginUrl = new URL("/login", request.url);
  loginUrl.search = "";

  if (!isSameOriginPost(request)) {
    loginUrl.searchParams.set("error", "Solicitud no válida. Volvé a intentar desde la página de login.");
    return redirectGet(loginUrl);
  }

  const formData = await request.formData();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  if (!email) {
    loginUrl.searchParams.set("error", "Ingresá tu email para recuperar la contraseña.");
    return redirectGet(loginUrl);
  }

  const publicSite = getPublicSiteUrl(request.nextUrl.origin);
  const recoveryRedirect = `${publicSite}/auth/confirm?next=${encodeURIComponent("/login/restablecer")}`;

  const successUrl = new URL("/login", request.url);
  successUrl.searchParams.set("reset", "sent");
  successUrl.searchParams.set("email", email);

  const response = redirectGet(successUrl);

  const supabase = createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: recoveryRedirect,
  });

  if (error) {
    const failUrl = new URL("/login", request.url);
    failUrl.searchParams.set("email", email);
    const msg = error.message.toLowerCase();
    if (msg.includes("redirect") || msg.includes("url")) {
      failUrl.searchParams.set(
        "error",
        "No pudimos enviar el link de recuperación. Probá de nuevo en unos minutos o contactá soporte."
      );
    } else if (msg.includes("rate")) {
      failUrl.searchParams.set(
        "error",
        "Demasiados intentos. Esperá unos minutos e intentá de nuevo."
      );
    } else {
      failUrl.searchParams.set(
        "error",
        "No pudimos enviar el email. Revisá que el correo sea correcto e intentá de nuevo."
      );
    }
    return redirectGet(failUrl);
  }

  return response;
}
