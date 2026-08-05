import { createServerClient } from "@supabase/ssr";
import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";

import { getSupabaseAnonKey, getSupabaseUrl } from "@/core/supabase/env";
import { otpTypeSchema, parseSafeRedirectPath } from "@/core/validations/auth-redirect";

/**
 * Confirmación de email / recovery (Supabase manda token_hash + type).
 * Docs: https://supabase.com/docs/guides/auth/passwords#resetting-a-password
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const typeRaw = searchParams.get("type");
  const code = searchParams.get("code");
  const next = parseSafeRedirectPath(searchParams.get("next"), "/login/restablecer");

  const redirectTo = new URL(next, origin);
  const errorUrl = new URL("/login", origin);

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

  try {
    if (token_hash && typeRaw) {
      const typeParsed = otpTypeSchema.safeParse(typeRaw);
      if (!typeParsed.success) {
        errorUrl.searchParams.set("error", "Link de recuperación inválido.");
        return NextResponse.redirect(errorUrl, 303);
      }

      const type = typeParsed.data as EmailOtpType;
      const { data, error } = await supabase.auth.verifyOtp({ type, token_hash });
      if (error) {
        errorUrl.searchParams.set(
          "error",
          "El link de recuperación expiró o ya fue usado. Pedí uno nuevo."
        );
        return NextResponse.redirect(errorUrl, 303);
      }
      if (data.session) {
        await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });
      }
      return response;
    }

    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        errorUrl.searchParams.set(
          "error",
          "El link expiró o ya fue usado. Pedí un nuevo restablecimiento."
        );
        return NextResponse.redirect(errorUrl, 303);
      }
      return response;
    }
  } catch {
    errorUrl.searchParams.set("error", "No pudimos validar el link. Pedí uno nuevo desde el login.");
    return NextResponse.redirect(errorUrl, 303);
  }

  if (next.includes("restablecer")) {
    return NextResponse.redirect(new URL("/login/restablecer", origin), 303);
  }

  errorUrl.searchParams.set("error", "Link de recuperación inválido.");
  return NextResponse.redirect(errorUrl, 303);
}
