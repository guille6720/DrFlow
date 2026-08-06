import type { UserRole } from "@/types/database";

export type PermissionKey = keyof typeof PERMISSIONS;

export const ROLE_LABELS: Record<UserRole, string> = {
  superadmin: "Superadmin SaaS",
  clinic_admin: "Administrador de clínica",
  doctor: "Médico",
  secretary: "Secretaría / Recepción",
  patient: "Paciente",
};

export const PERMISSIONS = {
  manageClinic: ["superadmin", "clinic_admin"] as UserRole[],
  manageStaff: ["superadmin", "clinic_admin"] as UserRole[],
  manageAppointments: ["superadmin", "clinic_admin", "secretary", "doctor"] as UserRole[],
  /** HC completa: secretaría excluida por normativa operativa */
  viewClinicalRecords: ["superadmin", "clinic_admin", "doctor"] as UserRole[],
  viewPharmacology: ["superadmin", "clinic_admin", "doctor"] as UserRole[],
  editClinicalRecords: ["superadmin", "clinic_admin", "doctor"] as UserRole[],
  issuePrescriptions: ["superadmin", "clinic_admin", "doctor"] as UserRole[],
  managePatients: ["superadmin", "clinic_admin", "secretary", "doctor"] as UserRole[],
  /** Solo datos administrativos del paciente */
  managePatientsAdmin: ["superadmin", "clinic_admin", "secretary"] as UserRole[],
  viewReports: ["superadmin", "clinic_admin", "secretary"] as UserRole[],
  managePayments: ["superadmin", "clinic_admin", "secretary"] as UserRole[],
  manageCashRegister: ["superadmin", "clinic_admin", "secretary", "doctor"] as UserRole[],
  manageWaitingRoom: ["superadmin", "clinic_admin", "secretary", "doctor"] as UserRole[],
  manageAdminDocuments: ["superadmin", "clinic_admin", "secretary"] as UserRole[],
  manageSettings: ["superadmin", "clinic_admin"] as UserRole[],
};

export const MANAGEABLE_PERMISSION_KEYS = [
  "manageAppointments",
  "managePatients",
  "managePatientsAdmin",
  "viewClinicalRecords",
  "viewPharmacology",
  "editClinicalRecords",
  "issuePrescriptions",
  "viewReports",
  "managePayments",
  "manageCashRegister",
  "manageWaitingRoom",
  "manageAdminDocuments",
] as const satisfies readonly PermissionKey[];

export type ManageablePermissionKey = (typeof MANAGEABLE_PERMISSION_KEYS)[number];

export type PermissionOverrides = Partial<Record<ManageablePermissionKey, boolean>>;

export function hasPermission(
  role: UserRole | null,
  permission: PermissionKey,
  isSuperadmin = false,
  overrides?: PermissionOverrides
): boolean {
  if (isSuperadmin || role === "superadmin") return true;
  if (!role) return false;
  if (overrides && permission in overrides) {
    return overrides[permission as ManageablePermissionKey]!;
  }
  return PERMISSIONS[permission].includes(role);
}

export function canAccessRoute(
  role: UserRole | null,
  route: string,
  isSuperadmin = false,
  overrides?: PermissionOverrides
): boolean {
  if (isSuperadmin || role === "superadmin") return true;

  // Mocks / QA interno: fuera del producto clínico
  if (
    route.startsWith("/qa") ||
    route.startsWith("/pagos") ||
    route.startsWith("/telemedicina")
  ) {
    return false;
  }

  if (route.startsWith("/historias/nueva")) {
    return hasPermission(role, "editClinicalRecords", isSuperadmin, overrides);
  }
  if (route.startsWith("/historias/") && route.includes("/editar")) {
    return hasPermission(role, "editClinicalRecords", isSuperadmin, overrides);
  }
  if (route.startsWith("/pacientes/") && route.includes("/editar")) {
    return hasPermission(role, "managePatients", isSuperadmin, overrides);
  }

  const routePermissions: Record<string, PermissionKey> = {
    "/configuracion": "manageSettings",
    "/reportes": "viewReports",
    "/historias": "viewClinicalRecords",
    "/recetas": "issuePrescriptions",
    "/herramientas": "viewPharmacology",
    "/caja": "manageCashRegister",
    "/sala-espera": "manageWaitingRoom",
    "/secretaria": "manageAdminDocuments",
    "/ingreso-profesionales": "manageStaff",
  };

  for (const [prefix, permission] of Object.entries(routePermissions)) {
    if (route.startsWith(prefix)) {
      return hasPermission(role, permission, isSuperadmin, overrides);
    }
  }

  return true;
}
