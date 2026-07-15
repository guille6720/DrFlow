import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSiteUrl, getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  const loginUrl = new URL("/login", request.url);
  loginUrl.search = "";

  if (!email) {
    loginUrl.searchParams.set("error", "Ingresá tu email para recuperar la contraseña.");
    return NextResponse.redirect(loginUrl);
  }

  const siteUrl = getSiteUrl(request.nextUrl.origin);
  const recoveryRedirect = `${siteUrl}/auth/callback?next=${encodeURIComponent("/login/restablecer")}`;

  const successUrl = new URL("/login", request.url);
  successUrl.searchParams.set("reset", "sent");
  successUrl.searchParams.set("email", email);

  const response = NextResponse.redirect(successUrl);

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
        `URL de redirección no autorizada. En Supabase → Authentication → URL Configuration agregá: ${siteUrl}/auth/callback`
      );
    } else if (msg.includes("rate")) {
      failUrl.searchParams.set(
        "error",
        "Demasiados intentos. Esperá unos minutos e intentá de nuevo."
      );
    } else {
      failUrl.searchParams.set(
        "error",
        `No pudimos enviar el email (${error.message}). Revisá SMTP en Supabase → Project Settings → Auth, o pedí recovery desde Authentication → Users.`
      );
    }
    return NextResponse.redirect(failUrl);
  }

  return response;
}
