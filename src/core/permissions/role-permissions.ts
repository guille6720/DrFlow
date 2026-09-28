import {
  MANAGEABLE_PERMISSION_KEYS,
  type ManageablePermissionKey,
  type PermissionOverrides,
  PERMISSIONS,
} from "@/core/permissions/roles";

import type { UserRole } from "@/types/database";

/** Roles whose permissions a clinic can tune. clinic_admin/superadmin always have full access. */
export const EDITABLE_ROLES = ["doctor", "secretary"] as const;
export type EditableRole = (typeof EDITABLE_ROLES)[number];

export type RolePermissionOverrides = Partial<Record<EditableRole, PermissionOverrides>>;

export type PermissionGroup = {
  id: string;
  label: string;
  keys: ManageablePermissionKey[];
};

export const PERMISSION_GROUPS: PermissionGroup[] = [
  { id: "agenda", label: "Agenda", keys: ["manageAppointments", "manageWaitingRoom"] },
  { id: "pacientes", label: "Pacientes", keys: ["managePatients", "managePatientsAdmin"] },
  {
    id: "clinico",
    label: "Historia clínica",
    keys: ["viewClinicalRecords", "editClinicalRecords", "issuePrescriptions", "viewPharmacology"],
  },
  {
    id: "administracion",
    label: "Administración",
    keys: ["viewReports", "managePayments", "manageCashRegister", "manageAdminDocuments"],
  },
  {
    id: "datos",
    label: "Importación y exportación",
    keys: [
      "importPatients",
      "exportPatients",
      "importClinicalRecords",
      "exportClinicalRecords",
      "bulkExportData",
    ],
  },
];

export function isEditableRole(role: unknown): role is EditableRole {
  return typeof role === "string" && (EDITABLE_ROLES as readonly string[]).includes(role);
}

function isManageableKey(key: string): key is ManageablePermissionKey {
  return (MANAGEABLE_PERMISSION_KEYS as readonly string[]).includes(key);
}

export function codeDefault(role: UserRole, key: ManageablePermissionKey): boolean {
  return PERMISSIONS[key].includes(role);
}

/** Role value inside a clinic (before member exceptions). */
export function roleEffective(
  role: UserRole,
  key: ManageablePermissionKey,
  roleOverrides?: RolePermissionOverrides | null
): boolean {
  if (isEditableRole(role)) {
    const value = roleOverrides?.[role]?.[key];
    if (typeof value === "boolean") return value;
  }
  return codeDefault(role, key);
}

export function buildRoleOverrides(
  rows: { role: string; permission_key: string; granted: boolean }[] | null | undefined
): RolePermissionOverrides {
  const out: RolePermissionOverrides = {};
  for (const row of rows ?? []) {
    if (!isEditableRole(row.role) || !isManageableKey(row.permission_key)) continue;
    (out[row.role] ??= {})[row.permission_key] = Boolean(row.granted);
  }
  return out;
}

/**
 * Final overrides for one member: member exception > clinic role setting.
 * Keys absent from the result fall back to the code default inside hasPermission().
 */
export function mergePermissionOverrides(
  role: UserRole | null,
  roleOverrides: RolePermissionOverrides | null | undefined,
  memberOverrides: PermissionOverrides | null | undefined
): PermissionOverrides {
  const base = role && isEditableRole(role) ? roleOverrides?.[role] ?? {} : {};
  return { ...base, ...(memberOverrides ?? {}) };
}

/** Value to persist for a role cell: null when it matches the code default (row removed). */
export function roleChangeValue(
  role: EditableRole,
  key: ManageablePermissionKey,
  nextGranted: boolean
): boolean | null {
  return nextGranted === codeDefault(role, key) ? null : nextGranted;
}

export function buildRoleChanges(
  role: EditableRole,
  keys: readonly string[],
  nextGranted: boolean
): Partial<Record<ManageablePermissionKey, boolean | null>> {
  const changes: Partial<Record<ManageablePermissionKey, boolean | null>> = {};
  for (const key of keys) {
    if (isManageableKey(key)) changes[key] = roleChangeValue(role, key, nextGranted);
  }
  return changes;
}

export function groupState(
  role: UserRole,
  group: PermissionGroup,
  roleOverrides?: RolePermissionOverrides | null
): "all" | "none" | "some" {
  const values = group.keys.map((key) => roleEffective(role, key, roleOverrides));
  if (values.every(Boolean)) return "all";
  if (values.every((v) => !v)) return "none";
  return "some";
}
