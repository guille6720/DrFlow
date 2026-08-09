import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import { logServerError } from "@/core/errors/log-error.server";
import { isUndefinedFunction } from "@/core/errors/postgres-error";

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
    await supabase.from("profiles").insert({
      id: userId,
      email,
      full_name: fullName ?? email.split("@")[0],
    });
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

  const cookieStore = await cookies();
  const current = cookieStore.get(CLINIC_COOKIE)?.value;
  if (current === clinicId) return clinicId;

  cookieStore.set(CLINIC_COOKIE, clinicId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });

  return clinicId;
}

/** Profile row + pending clinic invitations after a successful sign-in. */
export async function runPostLoginBootstrap(
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
  await ensureActiveClinicCookie(supabase, user.id);
}
