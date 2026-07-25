"use server";

import { getActiveClinicId, getActiveClinic } from "@/lib/auth/session";
import { hasPermission, PERMISSIONS } from "@/lib/permissions/roles";

export async function requireClinicPermission(permission: keyof typeof PERMISSIONS) {
  const clinicId = await getActiveClinicId();
  const { role, isSuperadmin } = await getActiveClinic();

  if (!clinicId || !hasPermission(role, permission, isSuperadmin)) {
    return { ok: false as const, error: "Sin permisos" };
  }

  return { ok: true as const, clinicId, role, isSuperadmin };
}

export async function requireActiveClinic() {
  const clinicId = await getActiveClinicId();
  if (!clinicId) {
    return { ok: false as const, error: "Sin clínica activa" };
  }
  return { ok: true as const, clinicId };
}
