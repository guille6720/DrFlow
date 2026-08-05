import { getActiveClinic, getActiveClinicId, getSession } from "@/core/auth/session.server";
import { hasPermission } from "@/core/permissions/roles";
import type { ServiceResult } from "@/core/services/types";
import { serviceErr, serviceOk } from "@/core/services/types";

export type ClinicalIssueAccess = {
  userId: string;
  clinicId: string;
};

/** Shared gate for prescriptions and medical orders (issuePrescriptions permission). */
export async function requireClinicalIssueAccess(options?: {
  deniedMessage?: string;
}): Promise<ServiceResult<ClinicalIssueAccess>> {
  const user = await getSession();
  const clinicId = await getActiveClinicId();
  const { role, isSuperadmin } = await getActiveClinic();

  if (!user || !clinicId) return serviceErr("Sesión requerida");
  if (!hasPermission(role, "issuePrescriptions", isSuperadmin)) {
    return serviceErr(options?.deniedMessage ?? "Solo médicos pueden emitir recetas");
  }

  return serviceOk({ userId: user.id, clinicId });
}

export async function requireMedicalOrderAccess(): Promise<ServiceResult<ClinicalIssueAccess>> {
  return requireClinicalIssueAccess({ deniedMessage: "Solo médicos pueden emitir órdenes" });
}

export type ClinicalRecordAccess = {
  userId: string;
  clinicId: string;
};

/** Gate for viewing/editing clinical records and attachments. */
export async function requireClinicalRecordAccess(
  mode: "view" | "edit"
): Promise<
  | { error: null; clinicId: string; userId: string }
  | { error: "Sin permisos" | "Sesión requerida"; clinicId: null; userId: null }
> {
  const clinicId = await getActiveClinicId();
  const { role, isSuperadmin } = await getActiveClinic();
  const permission = mode === "edit" ? "editClinicalRecords" : "viewClinicalRecords";
  if (!clinicId || !hasPermission(role, permission, isSuperadmin)) {
    return { error: "Sin permisos", clinicId: null, userId: null };
  }
  const user = await getSession();
  if (!user) return { error: "Sesión requerida", clinicId: null, userId: null };
  return { error: null, clinicId, userId: user.id };
}
