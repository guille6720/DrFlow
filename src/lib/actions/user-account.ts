"use server";

import { createClient } from "@/core/supabase/server";
import { getActiveClinic, getActiveClinicId, getSession } from "@/core/auth/session";
import { hasPermission, PERMISSIONS } from "@/core/permissions/roles";
import type { UserRole } from "@/types/database";
import { loadMyDoctorProfile, type MyDoctorProfileData } from "@/lib/actions/doctor-profile";

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

const MODULE_LINKS: { href: string; label: string; permission: keyof typeof PERMISSIONS | null }[] = [
  { href: "/dashboard", label: "Dashboard", permission: null },
  { href: "/agenda", label: "Agenda", permission: null },
  { href: "/sala-espera", label: "Sala de espera", permission: "manageWaitingRoom" },
  { href: "/pacientes", label: "Pacientes", permission: "managePatients" },
  { href: "/caja", label: "Caja / Cobranzas", permission: "manageCashRegister" },
  { href: "/secretaria/documentos", label: "Documentos administrativos", permission: "manageAdminDocuments" },
  { href: "/historias", label: "Historia clínica", permission: "viewClinicalRecords" },
  { href: "/recetas", label: "Recetas", permission: "issuePrescriptions" },
  { href: "/reportes", label: "Reportes", permission: "viewReports" },
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

  const accessibleModules = MODULE_LINKS.filter((m) => {
    if (!m.permission) return true;
    return hasPermission(role, m.permission, isSuperadmin);
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
