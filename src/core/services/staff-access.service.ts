import type { User } from "@supabase/supabase-js";

import { getActiveClinic, getActiveClinicId, getSession } from "@/core/auth/session";
import { hasPermission } from "@/core/permissions/roles";

const DEFAULT_DENIED = "Solo administradores pueden gestionar el equipo";

export type StaffManagerAccessResult =
  | { ok: true; clinicId: string; user: User }
  | { ok: false; error: string };

/** Gate for invitations and professional intake (manageStaff). */
export async function requireStaffManagerAccess(options?: {
  deniedMessage?: string;
}): Promise<StaffManagerAccessResult> {
  const user = await getSession();
  const clinicId = await getActiveClinicId();
  const { role, isSuperadmin } = await getActiveClinic();
  if (!user || !clinicId) return { ok: false, error: "Sesión requerida" };
  if (!hasPermission(role, "manageStaff", isSuperadmin)) {
    return { ok: false, error: options?.deniedMessage ?? DEFAULT_DENIED };
  }
  return { ok: true, clinicId, user };
}
