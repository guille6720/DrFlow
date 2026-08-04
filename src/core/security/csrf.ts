import type { NextRequest } from "next/server";

/**
 * Validates that a state-changing request originated from the same site (CSRF mitigation).
 * Accepts matching Origin or Referer host against the request Host header.
 */
export function isSameOriginPost(request: NextRequest): boolean {
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

function normalizeHost(value: string | null): string | null {
  if (!value) return null;
  return value.toLowerCase().replace(/:\d+$/, "");
}
