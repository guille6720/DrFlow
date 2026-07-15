import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env";

/**
 * Callback OAuth / PKCE / recovery.
 */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const token_hash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type");
  const next = requestUrl.searchParams.get("next") ?? "/auth/complete";
  const authError = requestUrl.searchParams.get("error");
  const origin = requestUrl.origin;

  // Si viene token_hash, delegar a /auth/confirm (misma lógica que docs Supabase)
  if (token_hash && type) {
    const confirm = new URL("/auth/confirm", origin);
    confirm.searchParams.set("token_hash", token_hash);
    confirm.searchParams.set("type", type);
    confirm.searchParams.set("next", next.startsWith("/") ? next : "/login/restablecer");
    return NextResponse.redirect(confirm, 303);
  }

  if (authError) {
    const description =
      requestUrl.searchParams.get("error_description") ??
      requestUrl.searchParams.get("error_code") ??
      authError;
    const loginUrl = new URL("/login", origin);
    loginUrl.searchParams.set("error", description);
    return NextResponse.redirect(loginUrl, 303);
  }

  if (!code) {
    if (next.includes("restablecer")) {
      return NextResponse.redirect(new URL("/login/restablecer", origin), 303);
    }
    return NextResponse.redirect(new URL("/login", origin), 303);
  }

  const safeNext = next.startsWith("/") ? next : "/auth/complete";
  const redirectUrl = new URL(safeNext, origin);
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

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    const loginUrl = new URL("/login", origin);
    loginUrl.searchParams.set(
      "error",
      "El link expiró o ya fue usado. Pedí un nuevo restablecimiento o volvé a entrar con Google."
    );
    return NextResponse.redirect(loginUrl, 303);
  }

  return response;
}
