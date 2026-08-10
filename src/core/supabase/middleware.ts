import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import { createTraceId } from "@/core/observability/trace-id";

import { getSupabaseAnonKey, getSupabaseUrl } from "./env";

const AUTH_TIMEOUT_MS = 5000;
const CLINIC_COOKIE = "drflow_clinic_id";

function hasAuthCookie(request: NextRequest): boolean {
  return request.cookies.getAll().some((cookie) => cookie.name.includes("-auth-token"));
}

async function getUserWithTimeout(
  supabase: ReturnType<typeof createServerClient>
) {
  try {
    const result = await Promise.race([
      supabase.auth.getUser(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), AUTH_TIMEOUT_MS)),
    ]);

    if (!result) return null;
    return result.data.user ?? null;
  } catch {
    return null;
  }
}

function isPwaAsset(path: string): boolean {
  return (
    path === "/sw.js" ||
    path === "/sw-portal.js" ||
    path === "/manifest.webmanifest" ||
    path.endsWith("/manifest.webmanifest") ||
    path === "/robots.txt" ||
    path === "/sitemap.xml"
  );
}

function withRequestPath(response: NextResponse, path: string, traceId: string): NextResponse {
  response.headers.set("x-drflow-path", path);
  response.headers.set("x-drflow-trace-id", traceId);
  return response;
}

async function ensureActiveClinicCookieOnResponse(
  request: NextRequest,
  response: NextResponse,
  supabase: ReturnType<typeof createServerClient>,
  userId: string
): Promise<NextResponse> {
  if (request.cookies.get(CLINIC_COOKIE)?.value) return response;

  try {
    const { data: members } = await supabase
      .from("clinic_members")
      .select("clinic_id")
      .eq("user_id", userId)
      .eq("is_active", true)
      .limit(1);

    const clinicId = members?.[0]?.clinic_id;
    if (!clinicId) return response;

    response.cookies.set(CLINIC_COOKIE, clinicId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
    });
  } catch {
    // Non-blocking: dashboard resolves clinic from membership when cookie is missing.
  }

  return response;
}

export async function updateSession(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const traceId = request.headers.get("x-drflow-trace-id") ?? createTraceId();

  if (isPwaAsset(path)) {
    return NextResponse.next({ request });
  }

  if (path.startsWith("/api/auth")) {
    return NextResponse.next({ request });
  }

  if (path === "/api/version" || path === "/api/health" || path.startsWith("/api/health/")) {
    return NextResponse.next({ request });
  }

  if (path.startsWith("/api/jobs/") || path.startsWith("/api/observability/")) {
    return NextResponse.next({ request });
  }

  if (path.startsWith("/auth/")) {
    return NextResponse.next({ request });
  }

  const isAuthRoute = path.startsWith("/login") || path.startsWith("/register");
  const isFullyPublic =
    path.startsWith("/solicitar-turno") ||
    path.startsWith("/portal") ||
    path === "/privacidad" ||
    path === "/terminos" ||
    path === "/aviso-paciente" ||
    path === "/" ||
    path === "/demo" ||
    path === "/probar" ||
    path === "/planes" ||
    path === "/onboarding" ||
    path.startsWith("/acceso-invitado") ||
    path.startsWith("/auth/");

  if (isFullyPublic && !isAuthRoute) {
    return NextResponse.next({ request });
  }

  const isPublicRoute =
    isFullyPublic || isAuthRoute;

  if (!hasAuthCookie(request)) {
    if (!isPublicRoute) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  let supabaseUrl: string;
  let supabaseKey: string;
  try {
    supabaseUrl = getSupabaseUrl();
    supabaseKey = getSupabaseAnonKey();
  } catch {
    return supabaseResponse;
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  const user = await getUserWithTimeout(supabase);

  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return withRequestPath(NextResponse.redirect(url), path, traceId);
  }

  if (user) {
    supabaseResponse = await ensureActiveClinicCookieOnResponse(
      request,
      supabaseResponse,
      supabase,
      user.id
    );
  }

  return withRequestPath(supabaseResponse, path, traceId);
}
