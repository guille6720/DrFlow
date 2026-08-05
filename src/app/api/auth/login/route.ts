import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import { isSameOriginPost } from "@/core/security/csrf";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/core/supabase/env";
import { firstZodIssue } from "@/core/validations/params";
import { loginSchema } from "@/core/validations/schemas";

import { runPostLoginBootstrap } from "@/lib/auth/post-login-bootstrap";

function mapAuthError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("email not confirmed") || lower.includes("confirm")) {
    return "Tu email no está confirmado. Revisá tu bandeja (y spam) o usá «Restablecer contraseña» abajo.";
  }
  if (lower.includes("invalid login") || lower.includes("invalid credentials")) {
    return "No pudimos iniciar sesión con ese email y contraseña.";
  }
  if (lower.includes("rate limit")) {
    return "Demasiados intentos. Esperá unos minutos.";
  }
  return message;
}

function redirectToLogin(request: NextRequest, error: string, email?: string) {
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  url.searchParams.set("error", error);
  if (email) url.searchParams.set("email", email);
  // 303 fuerza GET tras POST (evita HTTP 405 en /login)
  return NextResponse.redirect(url, 303);
}

export async function POST(request: NextRequest) {
  if (!isSameOriginPost(request)) {
    return redirectToLogin(request, "Solicitud no válida. Volvé a intentar desde la página de login.");
  }

  const formData = await request.formData();
  const parsed = loginSchema.safeParse({
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
  });

  if (!parsed.success) {
    return redirectToLogin(request, firstZodIssue(parsed.error));
  }

  const { email, password } = parsed.data;

  const redirectUrl = new URL("/dashboard", request.url);
  // 303 fuerza GET tras POST (evita 405 al redirigir)
  const response = NextResponse.redirect(redirectUrl, 303);

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

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return redirectToLogin(request, mapAuthError(error.message), email);
  }

  if (!data.user) {
    return redirectToLogin(request, "No se pudo iniciar sesión.", email);
  }

  await runPostLoginBootstrap(supabase, data.user);

  return response;
}
