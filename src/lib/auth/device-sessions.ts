import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";

import { logServerError } from "@/core/errors/log-error.server";
import { isUndefinedFunction } from "@/core/errors/postgres-error";
import { getAuditRequestContext } from "@/core/security/audit-context";

export const DEVICE_SESSION_COOKIE = "drflow_device_session";
export const MAX_DEVICE_SESSIONS = 3;

export const DEVICE_SESSION_REVOKED_MESSAGE =
  "Esta sesión se cerró porque la cuenta ya tiene 3 dispositivos conectados. Cerrá sesión en otro dispositivo o volvé a ingresar.";

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 400,
};

type ClaimResult = {
  ok: boolean;
  sessionId: string | null;
  reused: boolean;
  revokedIds: string[];
};

function parseClaimPayload(data: unknown): ClaimResult {
  const row = data && typeof data === "object" ? (data as Record<string, unknown>) : null;
  const sessionId = typeof row?.session_id === "string" ? row.session_id : null;
  const reused = Boolean(row?.reused);
  const revokedRaw = row?.revoked_ids;
  const revokedIds = Array.isArray(revokedRaw)
    ? revokedRaw.filter((id): id is string => typeof id === "string")
    : [];
  return {
    ok: Boolean(row?.ok) && Boolean(sessionId),
    sessionId,
    reused,
    revokedIds,
  };
}

export function readDeviceSessionIdFromCookieHeader(
  cookieStore: { get: (name: string) => { value: string } | undefined }
): string | null {
  const value = cookieStore.get(DEVICE_SESSION_COOKIE)?.value?.trim();
  return value || null;
}

export function setDeviceSessionCookieOnResponse(
  response: NextResponse,
  sessionId: string
): void {
  response.cookies.set(DEVICE_SESSION_COOKIE, sessionId, COOKIE_OPTIONS);
}

export function clearDeviceSessionCookieOnResponse(response: NextResponse): void {
  response.cookies.set(DEVICE_SESSION_COOKIE, "", { ...COOKIE_OPTIONS, maxAge: 0 });
}

export async function setDeviceSessionCookie(sessionId: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(DEVICE_SESSION_COOKIE, sessionId, COOKIE_OPTIONS);
}

export async function clearDeviceSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(DEVICE_SESSION_COOKIE);
}

/** Registers or reuses a device slot; revokes oldest sessions beyond the limit. */
export async function claimDeviceSession(
  supabase: SupabaseClient,
  existingSessionId?: string | null
): Promise<ClaimResult | null> {
  const ctx = await getAuditRequestContext();
  const { data, error } = await supabase.rpc("claim_user_device_session", {
    p_session_id: existingSessionId || null,
    p_user_agent: ctx.user_agent,
    p_ip_address: ctx.ip_address,
    p_max_sessions: MAX_DEVICE_SESSIONS,
  });

  if (error) {
    if (!isUndefinedFunction(error)) {
      logServerError("device-sessions.claim", error);
    }
    return null;
  }

  return parseClaimPayload(data);
}

/** Returns false when the session was revoked or is missing. */
export async function touchDeviceSession(
  supabase: SupabaseClient,
  sessionId: string | null | undefined
): Promise<{ active: boolean; reason?: string }> {
  if (!sessionId) return { active: false, reason: "missing" };

  const { data, error } = await supabase.rpc("touch_user_device_session", {
    p_session_id: sessionId,
  });

  if (error) {
    if (isUndefinedFunction(error)) {
      // Migration not applied yet — do not lock users out.
      return { active: true };
    }
    logServerError("device-sessions.touch", error);
    return { active: true };
  }

  const row = data && typeof data === "object" ? (data as Record<string, unknown>) : null;
  if (row?.ok) return { active: true };
  return { active: false, reason: typeof row?.reason === "string" ? row.reason : "revoked" };
}

export async function revokeCurrentDeviceSession(supabase: SupabaseClient): Promise<void> {
  const cookieStore = await cookies();
  const sessionId = readDeviceSessionIdFromCookieHeader(cookieStore);
  if (!sessionId) return;

  const { error } = await supabase.rpc("revoke_user_device_session", {
    p_session_id: sessionId,
  });
  if (error && !isUndefinedFunction(error)) {
    logServerError("device-sessions.revoke", error);
  }
  await clearDeviceSessionCookie();
}
