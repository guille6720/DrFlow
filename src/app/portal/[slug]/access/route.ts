import { NextResponse } from "next/server";

import {
  buildPortalCookieOptions,
  PATIENT_PORTAL_COOKIE,
} from "@/core/portal/patient-portal-cookie";
import { createClient } from "@/core/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Magic-link entry: /portal/[slug]/access?token=…
 * Validates server-side, sets HttpOnly cookie, redirects without token in URL.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug: rawSlug } = await context.params;
  const slug = rawSlug?.trim() ?? "";
  const url = new URL(request.url);
  const token = (url.searchParams.get("token") ?? "").trim().toLowerCase();

  const invalidUrl = new URL(`/portal/${encodeURIComponent(slug || "acceso")}`, url.origin);
  invalidUrl.searchParams.set("portal_error", "1");

  if (!slug || !/^[0-9a-f]{64}$/.test(token)) {
    return NextResponse.redirect(invalidUrl, 303);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("validate_patient_portal_session_v2", {
    p_token: token,
    p_slug: slug,
  });

  const row = Array.isArray(data) ? data[0] : data;
  const valid = Boolean(row && (row as { valid?: boolean }).valid === true);
  const expiresRaw = (row as { expires_at?: string | null } | null)?.expires_at ?? null;

  if (error || !valid || !expiresRaw) {
    return NextResponse.redirect(invalidUrl, 303);
  }

  const expiresAt = new Date(expiresRaw);
  if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
    return NextResponse.redirect(invalidUrl, 303);
  }

  const destination = new URL(`/portal/${encodeURIComponent(slug)}`, url.origin);
  const response = NextResponse.redirect(destination, 303);
  response.cookies.set(PATIENT_PORTAL_COOKIE, token, buildPortalCookieOptions(expiresAt));
  // Never echo token in Location / body.
  response.headers.set("Cache-Control", "no-store");
  return response;
}
