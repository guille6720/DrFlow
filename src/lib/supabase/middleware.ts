import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseAnonKey, getSupabaseUrl } from "./env";

const AUTH_TIMEOUT_MS = 1200;

function hasAuthCookie(request: NextRequest): boolean {
  return request.cookies.getAll().some((cookie) => cookie.name.includes("-auth-token"));
}

async function getUserWithTimeout(
  supabase: ReturnType<typeof createServerClient>
) {
  try {
    const result = await Promise.race([
      supabase.auth.getSession(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), AUTH_TIMEOUT_MS)),
    ]);

    if (!result) return null;
    return result.data.session?.user ?? null;
  } catch {
    return null;
  }
}

function isPwaAsset(path: string): boolean {
  return (
    path === "/sw.js" ||
    path === "/sw-portal.js" ||
    path === "/manifest.webmanifest" ||
    path.endsWith("/manifest.webmanifest")
  );
}

export async function updateSession(request: NextRequest) {
  const path = request.nextUrl.pathname;

  if (isPwaAsset(path)) {
    return NextResponse.next({ request });
  }

  if (path.startsWith("/api/auth")) {
    return NextResponse.next({ request });
  }

  if (path.startsWith("/auth/callback")) {
    return NextResponse.next({ request });
  }

  const isAuthRoute = path.startsWith("/login") || path.startsWith("/register");
  const isFullyPublic =
    path.startsWith("/solicitar-turno") ||
    path.startsWith("/portal") ||
    path === "/privacidad" ||
    path === "/" ||
    path === "/onboarding";

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
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
