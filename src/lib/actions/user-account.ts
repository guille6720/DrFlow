"use server";

import { getActiveClinic, getActiveClinicId, getSession } from "@/core/auth/session.server";
import { getClinicEntitlements } from "@/core/entitlements/entitlements.server";
import { isHrefEntitledBySnapshot } from "@/core/entitlements/nav-features";
import { toClientEntitlementsSnapshot } from "@/core/entitlements/resolve";
import { hasPermission, PERMISSIONS } from "@/core/permissions/roles";
import { createClient } from "@/core/supabase/server";

import { loadMyDoctorProfile, type MyDoctorProfileData } from "@/lib/actions/doctor-profile";
import type { UserRole } from "@/types/database";

export type MyUserAccountData = {
  fullName: string;
  email: string;
  role: UserRole | null;
  clinicName: string | null;
  canManageStaff: boolean;
  accessibleModules: { href: string; label: string }[];
  showProfessionalForm: boolean;
  doctorProfile?: MyDoctorProfileData;
};

export const USER_ACCOUNT_MODULE_LINKS: {
  href: string;
  label: string;
  permission: keyof typeof PERMISSIONS | null;
}[] = [
  { href: "/dashboard", label: "Dashboard", permission: null },
  { href: "/agenda", label: "Agenda", permission: null },
  { href: "/sala-espera", label: "Sala de espera", permission: "manageWaitingRoom" },
  { href: "/pacientes", label: "Pacientes", permission: "managePatients" },
  { href: "/caja", label: "Caja / Cobranzas", permission: "manageCashRegister" },
  { href: "/facturacion/liquidacion", label: "Liquidación obras sociales", permission: "manageCashRegister" },
  { href: "/secretaria/documentos", label: "Documentos administrativos", permission: "manageAdminDocuments" },
  { href: "/historias", label: "Historia clínica", permission: "viewClinicalRecords" },
  { href: "/consultas", label: "Consultas", permission: "editClinicalRecords" },
  { href: "/telemedicina", label: "Telemedicina", permission: "viewClinicalRecords" },
  { href: "/recetas", label: "Recetas", permission: "issuePrescriptions" },
  { href: "/herramientas/farmacologia", label: "Farmacología", permission: "viewPharmacology" },
  { href: "/gemini", label: "Asistente IA", permission: "viewClinicalRecords" },
  { href: "/recordatorios", label: "Recordatorios WhatsApp", permission: "manageAppointments" },
  { href: "/pami/planillas", label: "Planillas PAMI", permission: "manageSettings" },
  { href: "/reportes", label: "Reportes", permission: "viewReports" },
  { href: "/reportes/bi", label: "Reportes avanzados", permission: "viewReports" },
  { href: "/configuracion", label: "Configuración y equipo", permission: "manageSettings" },
];

export async function loadMyUserAccount(): Promise<{
  data?: MyUserAccountData;
  error?: string;
}> {
  const user = await getSession();
  const clinicId = await getActiveClinicId();
  const { role, isSuperadmin, clinic } = await getActiveClinic();

  if (!user || !clinicId) return { error: "Tenés que iniciar sesión" };

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", user.id)
    .single();

  if (!profile) return { error: "No se encontró tu perfil" };

  const entitlements = await getClinicEntitlements();
  const snapshot = toClientEntitlementsSnapshot(entitlements);
  const accessibleModules = USER_ACCOUNT_MODULE_LINKS.filter((m) => {
    if (m.permission && !hasPermission(role, m.permission, isSuperadmin)) return false;
    return isHrefEntitledBySnapshot(m.href, snapshot);
  });

  const canManageStaff = hasPermission(role, "manageStaff", isSuperadmin);
  const showProfessionalForm =
    isSuperadmin ||
    role === "doctor" ||
    role === "clinic_admin";

  let doctorProfile: MyDoctorProfileData | undefined;
  if (showProfessionalForm) {
    const res = await loadMyDoctorProfile();
    if (res.data) doctorProfile = res.data;
  }

  return {
    data: {
      fullName: profile.full_name,
      email: profile.email,
      role,
      clinicName: clinic?.name ?? null,
      canManageStaff,
      accessibleModules,
      showProfessionalForm,
      doctorProfile,
    },
  };
}
