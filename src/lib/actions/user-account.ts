"use server";

import { getActiveClinic, getActiveClinicId, getSession } from "@/core/auth/session.server";
import { getClinicEntitlements } from "@/core/entitlements/entitlements.server";
import { isHrefEntitledBySnapshot } from "@/core/entitlements/nav-features";
import { toClientEntitlementsSnapshot } from "@/core/entitlements/resolve";
import { hasPermission } from "@/core/permissions/roles";
import { createClient } from "@/core/supabase/server";

import { loadMyDoctorProfile, type MyDoctorProfileData } from "@/lib/actions/doctor-profile";
import { USER_ACCOUNT_MODULE_LINKS } from "@/lib/constants/user-account-module-links";
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
