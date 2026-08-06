"use server";

import { getActiveClinicId, getPermissionContext } from "@/core/auth/session.server";
import { hasPermission, type PermissionKey } from "@/core/permissions/roles";

export async function requireClinicPermission(permission: PermissionKey) {
  const clinicId = await getActiveClinicId();
  const { role, isSuperadmin, permissionOverrides } = await getPermissionContext();

  if (!clinicId || !hasPermission(role, permission, isSuperadmin, permissionOverrides)) {
    return { ok: false as const, error: "Sin permisos" };
  }

  return { ok: true as const, clinicId, role, isSuperadmin, permissionOverrides };
}

/** Settings admin gate — same shape as legacy requireAdmin(). */
export async function requireSettingsAccess() {
  const access = await requireClinicPermission("manageSettings");
  if (!access.ok) return { error: access.error, clinicId: null as string | null };
  return { clinicId: access.clinicId, error: null };
}

export async function requireActiveClinic() {
  const clinicId = await getActiveClinicId();
  if (!clinicId) {
    return { ok: false as const, error: "Sin clínica activa" };
  }
  return { ok: true as const, clinicId };
}
