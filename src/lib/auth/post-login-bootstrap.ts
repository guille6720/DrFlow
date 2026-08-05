import type { SupabaseClient } from "@supabase/supabase-js";

import { logServerError } from "@/core/errors/log-error.server";

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
  if (error && !error.message.includes("accept_clinic_invitations")) {
    logServerError("post-login-bootstrap.accept-invitations", error);
  }
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
}
