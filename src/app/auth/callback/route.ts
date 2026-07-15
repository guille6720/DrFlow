import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env";

/**
 * Callback OAuth / recovery.
 * - next=/login/restablecer → flujo blanqueo de contraseña
 * - next=/auth/complete (Google) → dashboard u onboarding
 */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") ?? "/auth/complete";
  const authError = requestUrl.searchParams.get("error");
  const origin = requestUrl.origin;

  if (authError) {
    const description =
      requestUrl.searchParams.get("error_description") ??
      requestUrl.searchParams.get("error_code") ??
      authError;
    const loginUrl = new URL("/login", origin);
    loginUrl.searchParams.set("error", description);
    return NextResponse.redirect(loginUrl);
  }

  if (!code) {
    // Pueden venir tokens en el hash (#access_token=...) — el cliente los lee en restablecer
    if (next.includes("restablecer")) {
      return NextResponse.redirect(new URL("/login/restablecer", origin));
    }
    return NextResponse.redirect(new URL("/login", origin));
  }

  const safeNext = next.startsWith("/") ? next : "/auth/complete";
  const redirectUrl = new URL(safeNext, origin);
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

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    const loginUrl = new URL("/login", origin);
    loginUrl.searchParams.set(
      "error",
      "El link expiró o ya fue usado. Pedí un nuevo restablecimiento o volvé a entrar con Google."
    );
    return NextResponse.redirect(loginUrl);
  }

  return response;
}
