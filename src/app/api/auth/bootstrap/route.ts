import { type NextRequest, NextResponse } from "next/server";

import { requireSameOriginMutation } from "@/core/security/csrf";
import { createClient } from "@/core/supabase/server";

import {
  claimDeviceSession,
  DEVICE_SESSION_COOKIE,
  setDeviceSessionCookieOnResponse,
} from "@/lib/auth/device-sessions";
import { runPostLoginBootstrap } from "@/lib/auth/post-login-bootstrap";

export const dynamic = "force-dynamic";

/** Completes profile + invitations after client-side sign-in (PWA). */
export async function POST(request: NextRequest) {
  const csrfBlock = requireSameOriginMutation(request);
  if (csrfBlock) return csrfBlock;

  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  await runPostLoginBootstrap(supabase, user);

  const response = NextResponse.json({ ok: true });
  const existingDeviceId = request.cookies.get(DEVICE_SESSION_COOKIE)?.value ?? null;
  const claim = await claimDeviceSession(supabase, existingDeviceId);
  if (claim?.sessionId) {
    setDeviceSessionCookieOnResponse(response, claim.sessionId);
  }

  return response;
}
