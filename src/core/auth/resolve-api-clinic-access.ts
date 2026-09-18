/**
 * Resolve active clinic for dashboard API routes.
 *
 * Superadmin may operate on the cookie clinic (same as agenda / getActiveClinicId).
 * Remapping cookie → first membership clinic caused "Turno no encontrado" when a
 * superadmin-member viewed another clinic's appointments and tried to cancel.
 */

export type ApiClinicMember = {
  clinic_id: string;
  role: string | null;
};

export type ResolveApiClinicAccessResult =
  | { ok: true; clinicId: string }
  | { ok: false; error: string; status: 403 };

export function resolveApiClinicAccess(params: {
  cookieClinicId: string | null | undefined;
  members: ApiClinicMember[];
  isSuperadmin: boolean;
  allowedRoles: Set<string>;
}): ResolveApiClinicAccessResult {
  const cookieClinicId = params.cookieClinicId?.trim() || null;
  const members = params.members;
  const { isSuperadmin, allowedRoles } = params;

  if (members.length === 0) {
    if (!isSuperadmin) {
      return { ok: false, error: "Sin permisos", status: 403 };
    }
    if (!cookieClinicId) {
      return { ok: false, error: "Sin clínica activa", status: 403 };
    }
    return { ok: true, clinicId: cookieClinicId };
  }

  if (isSuperadmin) {
    const clinicId = cookieClinicId ?? members[0]?.clinic_id ?? null;
    if (!clinicId) {
      return { ok: false, error: "Sin clínica activa", status: 403 };
    }
    return { ok: true, clinicId };
  }

  let clinicId = cookieClinicId;
  if (!clinicId || !members.some((m) => m.clinic_id === clinicId)) {
    clinicId = members[0]?.clinic_id ?? null;
  }
  if (!clinicId) {
    return { ok: false, error: "Sin clínica activa", status: 403 };
  }

  const membership = members.find((m) => m.clinic_id === clinicId);
  if (!membership?.role || !allowedRoles.has(membership.role)) {
    return { ok: false, error: "Sin permisos", status: 403 };
  }

  return { ok: true, clinicId };
}
