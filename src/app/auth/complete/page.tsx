import { redirect } from "next/navigation";

import { setActiveClinic } from "@/core/auth/session.actions";
import { createClient } from "@/core/supabase/server";

/**
 * Destino post-OAuth (Google): si ya tiene clínica → dashboard; si no → onboarding.
 */
export default async function AuthCompletePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?error=" + encodeURIComponent("Sesión no iniciada. Probá de nuevo."));
  }

  const { data: membership } = await supabase
    .from("clinic_members")
    .select("clinic_id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (membership?.clinic_id) {
    await setActiveClinic(membership.clinic_id);
    redirect("/dashboard");
  }

  redirect("/onboarding");
}
