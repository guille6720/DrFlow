"use server";

import { getActiveClinicId, getPermissionContext, getSession } from "@/core/auth/session.server";
import { hasPermission, type PermissionKey } from "@/core/permissions/roles";

export async function requireClinicPermission(permission: PermissionKey) {
  const [clinicId, perm, user] = await Promise.all([
    getActiveClinicId(),
    getPermissionContext(),
    getSession(),
  ]);

  if (
    !clinicId ||
    !hasPermission(perm.role, permission, perm.isSuperadmin, perm.permissionOverrides)
  ) {
    return { ok: false as const, error: "Sin permisos" };
  }
  if (!user) {
    return { ok: false as const, error: "Sin sesión" };
  }

  return {
    ok: true as const,
    clinicId,
    userId: user.id,
    role: perm.role,
    isSuperadmin: perm.isSuperadmin,
    permissionOverrides: perm.permissionOverrides,
  };
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

/** Any of the listed permissions is enough (import/export hub). */
export async function requireAnyClinicPermission(permissions: PermissionKey[]) {
  const [clinicId, perm, user] = await Promise.all([
    getActiveClinicId(),
    getPermissionContext(),
    getSession(),
  ]);

  const allowed = permissions.some((permission) =>
    hasPermission(perm.role, permission, perm.isSuperadmin, perm.permissionOverrides)
  );

  if (!clinicId || !allowed) {
    return { ok: false as const, error: "Sin permisos" };
  }
  if (!user) {
    return { ok: false as const, error: "Sin sesión" };
  }

  return {
    ok: true as const,
    clinicId,
    userId: user.id,
    role: perm.role,
    isSuperadmin: perm.isSuperadmin,
    permissionOverrides: perm.permissionOverrides,
  };
}
