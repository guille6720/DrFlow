import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const email = String(formData.get("email") ?? "").trim();

  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";

  if (!email) {
    url.searchParams.set("error", "Ingresá tu email para recuperar la contraseña.");
    return NextResponse.redirect(url);
  }

  const redirectTo = new URL("/login", request.url);
  redirectTo.searchParams.set("reset", "sent");
  redirectTo.searchParams.set("email", email);

  const response = NextResponse.redirect(redirectTo);

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
    redirectTo: `${new URL(request.url).origin}/auth/callback?next=/login/restablecer`,
  });

  if (error) {
    url.searchParams.set(
      "error",
      "No pudimos enviar el email. Verificá el email o reseteá desde Supabase → Users."
    );
    url.searchParams.set("email", email);
    return NextResponse.redirect(url);
  }

  return response;
}
