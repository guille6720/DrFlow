import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { logServerError } from "@/core/errors/log-error.server";
import { isUndefinedFunction } from "@/core/errors/postgres-error";

import {
  clearDeviceSessionCookie,
  DEVICE_SESSION_REVOKED_MESSAGE,
  readDeviceSessionIdFromCookieHeader,
  touchDeviceSession,
} from "@/lib/auth/device-sessions";

const CLINIC_COOKIE = "drflow_clinic_id";

export async function ensureUserProfile(
  supabase: SupabaseClient,
  userId: string,
  email: string,
  fullName?: string
) {
  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (!existing) {
    const { error } = await supabase.from("profiles").insert({
      id: userId,
      email,
      full_name: fullName ?? email.split("@")[0],
    });
    if (error) {
      logServerError("post-login-bootstrap.ensure-user-profile", error);
    }
  }
}

/** Best-effort: attach pending clinic invitations to the signed-in user. */
export async function acceptPendingInvitationsForUser(supabase: SupabaseClient) {
  const { error } = await supabase.rpc("accept_clinic_invitations_for_user");
  if (error && !isUndefinedFunction(error)) {
    logServerError("post-login-bootstrap.accept-invitations", error);
  }
}

/** Sets the active clinic cookie when the user belongs to at least one clinic. */
export async function ensureActiveClinicCookie(
  supabase: SupabaseClient,
  userId: string
): Promise<string | null> {
  const cookieStore = await cookies();
  const current = cookieStore.get(CLINIC_COOKIE)?.value;
  // Warm path: trust existing clinic cookie (avoids a clinic_members round-trip every nav).
  if (current) return current;

  const { data: members, error } = await supabase
    .from("clinic_members")
    .select("clinic_id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .limit(1);

  if (error) {
    logServerError("post-login-bootstrap.ensure-active-clinic", error);
    return null;
  }

  const clinicId = members?.[0]?.clinic_id ?? null;
  if (!clinicId) return null;

  try {
    cookieStore.set(CLINIC_COOKIE, clinicId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
    });
  } catch (err) {
    logServerError("post-login-bootstrap.ensure-active-clinic-cookie", err);
    return clinicId;
  }

  return clinicId;
}

/** Profile + pending invitations (safe during Server Component render). */
export async function syncUserClinicMembership(
  supabase: SupabaseClient,
  user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> }
) {
  const email = user.email ?? "";
  await ensureUserProfile(
    supabase,
    user.id,
    email,
    user.user_metadata?.full_name as string | undefined
  );
  await acceptPendingInvitationsForUser(supabase);
}

/** Ensures profile, invitations, and clinic cookie before dashboard shell loads.
 * Warm navigations (clinic cookie already set) skip membership bootstrap RPCs —
 * those run on login / client DashboardSessionBootstrap instead.
 */
export async function prepareDashboardSession(
  supabase: SupabaseClient,
  user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> }
) {
  const cookieStore = await cookies();
  const hasClinicCookie = Boolean(cookieStore.get(CLINIC_COOKIE)?.value);

  if (!hasClinicCookie) {
    await syncUserClinicMembership(supabase, user);
    await ensureActiveClinicCookie(supabase, user.id);
  }

  await enforceDeviceSessionOrSignOut(supabase);
}

/** Profile row + pending clinic invitations after a successful sign-in. */
export async function runPostLoginBootstrap(
  supabase: SupabaseClient,
  user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> }
) {
  await syncUserClinicMembership(supabase, user);
  await ensureActiveClinicCookie(supabase, user.id);
}

/** Keep an existing device slot valid; sign out only when this device was kicked. */
export async function enforceDeviceSessionOrSignOut(supabase: SupabaseClient): Promise<void> {
  try {
    const cookieStore = await cookies();
    const existingId = readDeviceSessionIdFromCookieHeader(cookieStore);

    // Claiming/setting cookies must happen in Route Handlers (login/bootstrap/OAuth).
    // Doing cookies().set during RSC render crashes the dashboard in production.
    if (!existingId) return;

    const touch = await touchDeviceSession(supabase, existingId);
    if (touch.active) return;

    try {
      await clearDeviceSessionCookie();
    } catch {
      // Cookie writes can fail outside Route Handlers / Server Actions.
    }

    if (touch.reason === "revoked") {
      await supabase.auth.signOut();
      redirect(`/login?error=${encodeURIComponent(DEVICE_SESSION_REVOKED_MESSAGE)}`);
    }
  } catch (err) {
    if (
      typeof err === "object" &&
      err !== null &&
      "digest" in err &&
      String((err as { digest: string }).digest).startsWith("NEXT_REDIRECT")
    ) {
      throw err;
    }
    logServerError("post-login-bootstrap.enforce-device-session", err);
  }
}

