import type { User } from "@supabase/supabase-js";

import { requireStaffManagerAccess } from "@/core/services/staff-access.service";

/** Staff manager gate for invitations — returns `{ user, clinicId }` on success. */
export async function requireStaffManagerWithUser(options?: {
  deniedMessage?: string;
}): Promise<
  | { ok: false; error: string }
  | { ok: true; user: User; clinicId: string }
> {
  const access = await requireStaffManagerAccess(options);
  if (!access.ok) return { ok: false, error: access.error };
  return { ok: true, user: access.user, clinicId: access.clinicId };
}

/** Staff manager gate for professional intake — `{ clinicId, error: null }` on success. */
export async function requireStaffManagerWithClinicId(options?: {
  deniedMessage?: string;
}): Promise<
  | { ok: false; error: string; clinicId: null }
  | { ok: true; clinicId: string; error: null }
> {
  const access = await requireStaffManagerAccess(options);
  if (!access.ok) return { ok: false, error: access.error, clinicId: null };
  return { ok: true, clinicId: access.clinicId, error: null };
}
