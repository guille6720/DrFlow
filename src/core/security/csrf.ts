import { type NextRequest, NextResponse } from "next/server";

type RequestLike = Pick<Request, "headers">;

/**
 * Validates that a state-changing request originated from the same site (CSRF mitigation).
 * Accepts matching Origin or Referer host against the request Host header.
 */
export function isSameOriginRequest(request: RequestLike): boolean {
  const host = normalizeHost(request.headers.get("host"));
  if (!host) return false;

  const origin = request.headers.get("origin");
  if (origin) {
    try {
      return normalizeHost(new URL(origin).host) === host;
    } catch {
      return false;
    }
  }

  const referer = request.headers.get("referer");
  if (referer) {
    try {
      return normalizeHost(new URL(referer).host) === host;
    } catch {
      return false;
    }
  }

  return false;
}

/** @deprecated Prefer {@link isSameOriginRequest} — works with Request and NextRequest. */
export function isSameOriginPost(request: NextRequest): boolean {
  return isSameOriginRequest(request);
}

/** Returns 403 JSON when Origin/Referer do not match Host; null when the request is same-origin. */
export function requireSameOriginMutation(request: RequestLike): NextResponse | null {
  if (isSameOriginRequest(request)) return null;
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

function normalizeHost(value: string | null): string | null {
  if (!value) return null;
  return value.toLowerCase().replace(/:\d+$/, "");
}
