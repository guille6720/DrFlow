import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env";
import { acceptPendingInvitations } from "@/lib/actions/invitations";
import { hasAdminClient } from "@/lib/supabase/admin";

function mapAuthError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("email not confirmed") || lower.includes("confirm")) {
    return "Tu email no está confirmado. En Supabase → Authentication → Users → Confirm user, o usá «Restablecer contraseña» abajo.";
  }
  if (lower.includes("invalid login") || lower.includes("invalid credentials")) {
    return "No pudimos iniciar sesión con ese email y contraseña.";
  }
  if (lower.includes("rate limit")) {
    return "Demasiados intentos. Esperá unos minutos.";
  }
  return message;
}

async function diagnoseLoginFailure(email: string): Promise<string | null> {
  if (!hasAdminClient()) return null;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !service) return null;

  try {
    const res = await fetch(
      `${url}/auth/v1/admin/users?email=${encodeURIComponent(email)}`,
      {
        headers: {
          apikey: service,
          Authorization: `Bearer ${service}`,
        },
      }
    );
    const data = (await res.json()) as {
      users?: Array<{ email_confirmed_at?: string | null }>;
    };

    if (!res.ok || !data.users?.length) {
      return "Este email no está registrado. Creá tu cuenta en «Registrar clínica».";
    }

    const user = data.users[0];
    if (!user.email_confirmed_at) {
      return "Tu cuenta existe pero el email no está confirmado. En Supabase → Authentication → Users → Confirm user, o restablecé la contraseña abajo.";
    }

    return "La contraseña no coincide. Usá «Restablecer contraseña» abajo o Supabase → Users → Send password recovery.";
  } catch {
    return null;
  }
}

function redirectToLogin(request: NextRequest, error: string, email?: string) {
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  url.searchParams.set("error", error);
  if (email) url.searchParams.set("email", email);
  return NextResponse.redirect(url);
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

  if (password.length < 6) {
    return redirectToLogin(request, "La contraseña debe tener al menos 6 caracteres.", email);
  }

  const redirectUrl = new URL("/dashboard", request.url);
  const response = NextResponse.redirect(redirectUrl);

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
    const mapped = mapAuthError(error.message);
    const lower = error.message.toLowerCase();
    const detailed =
      lower.includes("invalid login") || lower.includes("invalid credentials")
        ? (await diagnoseLoginFailure(email)) ?? mapped
        : mapped;
    return redirectToLogin(request, detailed, email);
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
