import { getActiveClinic, getActiveClinicId, getSession } from "@/core/auth/session.server";
import { hasPermission } from "@/core/permissions/roles";

export type ImportAccessResult =
  | { error: null; clinicId: string; userId: string }
  | { error: "Sin permisos" | "Sesión requerida"; clinicId: null; userId: null };

/** Gate for clinical CSV/HCE/JSONL/PDF import pipelines. */
export async function requireClinicalImportAccess(): Promise<ImportAccessResult> {
  const clinicId = await getActiveClinicId();
  const { role, isSuperadmin } = await getActiveClinic();
  const canImport =
    hasPermission(role, "editClinicalRecords", isSuperadmin) ||
    hasPermission(role, "managePatients", isSuperadmin);
  if (!clinicId || !canImport) {
    return { error: "Sin permisos", clinicId: null, userId: null };
  }
  const user = await getSession();
  if (!user) return { error: "Sesión requerida", clinicId: null, userId: null };
  return { error: null, clinicId, userId: user.id };
}

/** Gate for spreadsheet patient roster imports (consumers). */
export async function requirePatientImportAccess(): Promise<ImportAccessResult> {
  const clinicId = await getActiveClinicId();
  const { role, isSuperadmin } = await getActiveClinic();
  if (!clinicId || !hasPermission(role, "managePatients", isSuperadmin)) {
    return { error: "Sin permisos", clinicId: null, userId: null };
  }
  const user = await getSession();
  if (!user) return { error: "Sesión requerida", clinicId: null, userId: null };
  return { error: null, clinicId, userId: user.id };
}
