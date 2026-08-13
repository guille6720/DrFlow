import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import { getSupabaseAnonKey, getSupabaseUrl } from "@/core/supabase/env";
import {
  boundedErrorDescriptionSchema,
  parseSafeRedirectPath,
} from "@/core/validations/auth-redirect";

import {
  claimDeviceSession,
  DEVICE_SESSION_COOKIE,
  setDeviceSessionCookieOnResponse,
} from "@/lib/auth/device-sessions";

/**
 * Callback OAuth / PKCE / recovery.
 */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const token_hash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type");
  const next = parseSafeRedirectPath(requestUrl.searchParams.get("next"), "/auth/complete");
  const authError = requestUrl.searchParams.get("error");
  const origin = requestUrl.origin;

  if (token_hash && type) {
    const confirm = new URL("/auth/confirm", origin);
    confirm.searchParams.set("token_hash", token_hash);
    confirm.searchParams.set("type", type);
    confirm.searchParams.set("next", next);
    return NextResponse.redirect(confirm, 303);
  }

  if (authError) {
    const descriptionRaw =
      requestUrl.searchParams.get("error_description") ??
      requestUrl.searchParams.get("error_code") ??
      authError;
    const descriptionParsed = boundedErrorDescriptionSchema.safeParse(descriptionRaw);
    const description = descriptionParsed.success ? descriptionParsed.data : authError;
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

  const redirectUrl = new URL(next, origin);
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

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    const loginUrl = new URL("/login", origin);
    loginUrl.searchParams.set(
      "error",
      "El link expiró o ya fue usado. Pedí un nuevo restablecimiento o volvé a entrar con Google."
    );
    return NextResponse.redirect(loginUrl, 303);
  }

  if (data.session) {
    const existingDeviceId = request.cookies.get(DEVICE_SESSION_COOKIE)?.value ?? null;
    const claim = await claimDeviceSession(supabase, existingDeviceId);
    if (claim?.sessionId) {
      setDeviceSessionCookieOnResponse(response, claim.sessionId);
    }
  }

  return response;
}
