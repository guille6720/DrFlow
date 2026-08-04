import { getActiveClinic, getActiveClinicId, getSession } from "@/core/auth/session";
import { hasPermission } from "@/core/permissions/roles";
import type { ServiceResult } from "@/core/services/types";
import { serviceErr, serviceOk } from "@/core/services/types";

export type ClinicalIssueAccess = {
  userId: string;
  clinicId: string;
};

/** Shared gate for prescriptions and medical orders (issuePrescriptions permission). */
export async function requireClinicalIssueAccess(): Promise<
  ServiceResult<ClinicalIssueAccess>
> {
  const user = await getSession();
  const clinicId = await getActiveClinicId();
  const { role, isSuperadmin } = await getActiveClinic();

  if (!user || !clinicId) return serviceErr("Sesión requerida");
  if (!hasPermission(role, "issuePrescriptions", isSuperadmin)) {
    return serviceErr("Solo médicos pueden emitir recetas");
  }

  return serviceOk({ userId: user.id, clinicId });
}

export async function requireMedicalOrderAccess(): Promise<ServiceResult<ClinicalIssueAccess>> {
  const user = await getSession();
  const clinicId = await getActiveClinicId();
  const { role, isSuperadmin } = await getActiveClinic();

  if (!user || !clinicId) return serviceErr("Sesión requerida");
  if (!hasPermission(role, "issuePrescriptions", isSuperadmin)) {
    return serviceErr("Solo médicos pueden emitir órdenes");
  }

  return serviceOk({ userId: user.id, clinicId });
}
