import type { SupabaseClient } from "@supabase/supabase-js";

import { acceptPendingInvitations } from "@/lib/actions/invitations";

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
  await acceptPendingInvitations();
}
