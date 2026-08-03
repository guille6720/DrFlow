import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env";
import { acceptPendingInvitations } from "@/lib/actions/invitations";

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

async function ensureProfile(
  supabase: ReturnType<typeof createServerClient>,
  userId: string,
  email: string,
  fullName?: string
) {
  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (!existing) {
    await supabase.from("profiles").insert({
      id: userId,
      email,
      full_name: fullName ?? email.split("@")[0],
    });
  }
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return redirectToLogin(request, "Email y contraseña son obligatorios.", email);
  }

  if (password.length < 8) {
    return redirectToLogin(request, "La contraseña debe tener al menos 8 caracteres.", email);
  }

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

  await ensureProfile(
    supabase,
    data.user.id,
    data.user.email ?? email,
    data.user.user_metadata?.full_name as string | undefined
  );

  await acceptPendingInvitations();

  return response;
}
