import "server-only";

import { redirect } from "next/navigation";

import { getProfile, getSession } from "@/core/auth/session.server";

export async function requireSuperadminOrDeny(): Promise<
  { ok: true; userId: string } | { ok: false; error: string }
> {
  const [user, profile] = await Promise.all([getSession(), getProfile()]);
  if (!user || !profile?.is_superadmin) {
    return { ok: false, error: "Solo superadmin." };
  }
  return { ok: true, userId: user.id };
}

/** RSC page guard — redirects non-superadmins away without leaking commercial data. */
export async function requireSuperadminPage(): Promise<{ userId: string }> {
  const access = await requireSuperadminOrDeny();
  if (!access.ok) {
    redirect("/dashboard");
  }
  return { userId: access.userId };
}
