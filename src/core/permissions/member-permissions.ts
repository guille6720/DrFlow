import {
  hasPermission,
  MANAGEABLE_PERMISSION_KEYS,
  type ManageablePermissionKey,
  type PermissionKey,
  PERMISSIONS,
} from "@/core/permissions/roles";

import type { UserRole } from "@/types/database";

export { MANAGEABLE_PERMISSION_KEYS, type ManageablePermissionKey };

/** Permissions the clinic admin can grant or revoke per member (beyond role defaults). */
export const MANAGEABLE_PERMISSION_LABELS: Record<ManageablePermissionKey, string> = {
  manageAppointments: "Agenda y turnos",
  managePatients: "Pacientes",
  managePatientsAdmin: "Datos admin. pacientes",
  viewClinicalRecords: "Ver historias clínicas",
  viewPharmacology: "Guía farmacológica",
  editClinicalRecords: "Editar historias clínicas",
  issuePrescriptions: "Recetas y órdenes",
  viewReports: "Reportes",
  managePayments: "Pagos",
  manageCashRegister: "Caja",
  manageWaitingRoom: "Sala de espera",
  manageAdminDocuments: "Docs administrativos",
  importPatients: "Importar pacientes",
  exportPatients: "Exportar pacientes",
  importClinicalRecords: "Importar historias",
  exportClinicalRecords: "Exportar historias",
  bulkExportData: "Exportación masiva",
};

export type PermissionOverrideRow = {
  member_id: string;
  permission_key: string;
  granted: boolean;
};

export type PermissionOverridesByMember = Record<
  string,
  Partial<Record<ManageablePermissionKey, boolean>>
>;

export function isManageablePermissionKey(key: string): key is ManageablePermissionKey {
  return (MANAGEABLE_PERMISSION_KEYS as readonly string[]).includes(key);
}

export function buildPermissionOverridesByMember(
  rows: PermissionOverrideRow[]
): PermissionOverridesByMember {
  const map: PermissionOverridesByMember = {};
  for (const row of rows) {
    if (!isManageablePermissionKey(row.permission_key)) continue;
    if (!map[row.member_id]) map[row.member_id] = {};
    map[row.member_id]![row.permission_key] = row.granted;
  }
  return map;
}

export function rowsToMemberOverrideMap(
  rows: { permission_key: string; granted: boolean }[]
): Partial<Record<ManageablePermissionKey, boolean>> {
  const map: Partial<Record<ManageablePermissionKey, boolean>> = {};
  for (const row of rows) {
    if (!isManageablePermissionKey(row.permission_key)) continue;
    map[row.permission_key] = row.granted;
  }
  return map;
}

export function resolveEffectivePermission(
  role: UserRole | null,
  permission: PermissionKey,
  isSuperadmin: boolean,
  memberOverrides?: Partial<Record<ManageablePermissionKey, boolean>>
): boolean {
  return hasPermission(role, permission, isSuperadmin, memberOverrides);
}

export function resolveMemberPermissionOverrides(
  rows: { permission_key: string; granted: boolean }[]
): Partial<Record<ManageablePermissionKey, boolean>> {
  return rowsToMemberOverrideMap(rows);
}

export function getEffectivePermissionsForRole(
  role: UserRole,
  memberOverrides?: Partial<Record<ManageablePermissionKey, boolean>>
): Record<ManageablePermissionKey, boolean> {
  const result = {} as Record<ManageablePermissionKey, boolean>;
  for (const key of MANAGEABLE_PERMISSION_KEYS) {
    result[key] = resolveEffectivePermission(role, key, false, memberOverrides);
  }
  return result;
}

export function roleDefaultForPermission(role: UserRole, permission: ManageablePermissionKey): boolean {
  return PERMISSIONS[permission].includes(role);
}

export function computeOverrideOnToggle(
  role: UserRole,
  permission: ManageablePermissionKey,
  nextGranted: boolean
): boolean | null {
  const roleDefault = roleDefaultForPermission(role, permission);
  if (nextGranted === roleDefault) return null;
  return nextGranted;
}

export function canEditMemberPermissions(role: UserRole): boolean {
  return role !== "clinic_admin" && role !== "superadmin";
}
