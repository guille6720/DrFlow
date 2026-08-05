"use server";

import { getActiveClinic, getActiveClinicId } from "@/core/auth/session";
import { hasPermission, PERMISSIONS } from "@/core/permissions/roles";

export async function requireClinicPermission(permission: keyof typeof PERMISSIONS) {
  const clinicId = await getActiveClinicId();
  const { role, isSuperadmin } = await getActiveClinic();

  if (!clinicId || !hasPermission(role, permission, isSuperadmin)) {
    return { ok: false as const, error: "Sin permisos" };
  }

  return { ok: true as const, clinicId, role, isSuperadmin };
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
