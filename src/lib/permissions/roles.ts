import type { UserRole } from "@/types/database";

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
  viewClinicalRecords: ["superadmin", "clinic_admin", "doctor", "secretary"] as UserRole[],
  viewPharmacology: ["superadmin", "clinic_admin", "doctor"] as UserRole[],
  editClinicalRecords: ["superadmin", "clinic_admin", "doctor"] as UserRole[],
  issuePrescriptions: ["superadmin", "clinic_admin", "doctor"] as UserRole[],
  managePatients: ["superadmin", "clinic_admin", "secretary"] as UserRole[],
  viewReports: ["superadmin", "clinic_admin", "secretary"] as UserRole[],
  managePayments: ["superadmin", "clinic_admin", "secretary"] as UserRole[],
  manageSettings: ["superadmin", "clinic_admin"] as UserRole[],
};

export function hasPermission(
  role: UserRole | null,
  permission: keyof typeof PERMISSIONS,
  isSuperadmin = false
): boolean {
  if (isSuperadmin || role === "superadmin") return true;
  if (!role) return false;
  return PERMISSIONS[permission].includes(role);
}

export function canAccessRoute(
  role: UserRole | null,
  route: string,
  isSuperadmin = false
): boolean {
  if (isSuperadmin) return true;

  const routePermissions: Record<string, keyof typeof PERMISSIONS> = {
    "/configuracion": "manageSettings",
    "/reportes": "viewReports",
    "/historias": "viewClinicalRecords",
    "/recetas": "issuePrescriptions",
    "/herramientas": "viewPharmacology",
    "/pagos": "managePayments",
    "/qa": "manageSettings",
  };

  for (const [prefix, permission] of Object.entries(routePermissions)) {
    if (route.startsWith(prefix)) {
      return hasPermission(role, permission, isSuperadmin);
    }
  }

  if (route.startsWith("/historias/nueva") || route.includes("/editar")) {
    return hasPermission(role, "editClinicalRecords", isSuperadmin);
  }

  return true;
}
