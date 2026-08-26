"use server";

import { clearPatientPortalCookie } from "@/core/portal/patient-portal-cookie";

/** Clears the HttpOnly portal cookie. DB session expires naturally (no token→session_id RPC). */
export async function logoutPatientPortalSession() {
  await clearPatientPortalCookie();
  return { success: true as const };
}
