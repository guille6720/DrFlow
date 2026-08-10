import "server-only";

import { cookies } from "next/headers";
import { cache } from "react";

import { resolveMemberPermissionOverrides } from "@/core/permissions/member-permissions";
import type { PermissionOverrides } from "@/core/permissions/roles";
import { CLINIC_COLUMNS, CLINIC_SHELL_COLUMNS, PROFILE_COLUMNS } from "@/core/supabase/select-columns";
import { createClient } from "@/core/supabase/server";

import type { Clinic, ClinicMember, Profile, UserRole } from "@/types/database";

const CLINIC_COOKIE = "drflow_clinic_id";
const MEMBER_COLUMNS = "id, clinic_id, user_id, role, is_active";

async function loadClinicsForMembers(
  supabase: Awaited<ReturnType<typeof createClient>>,
  members: Array<{ id: string; clinic_id: string; user_id: string; role: UserRole; is_active: boolean }>,
  columns: string
): Promise<ClinicMember[]> {
  if (members.length === 0) return [];

  const clinicIds = [...new Set(members.map((m) => m.clinic_id))];
  const { data: clinics, error } = await supabase.from("clinics").select(columns).in("id", clinicIds);

  if (error) {
    console.error("[session] loadClinicsForMembers failed:", error.message);
    return members.map((member) => ({ ...member, clinic: undefined })) as unknown as ClinicMember[];
  }

  const clinicRows = (clinics ?? []) as unknown as Clinic[];
  const clinicById = new Map(clinicRows.map((clinic) => [clinic.id, clinic]));
  return members.map((member) => ({
    ...member,
    clinic: clinicById.get(member.clinic_id),
  })) as unknown as ClinicMember[];
}

export const getSession = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
});

export const getProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();
  const user = await getSession();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("id", user.id)
    .single();

  return data;
});

export const getUserClinics = cache(async (): Promise<ClinicMember[]> => {
  const supabase = await createClient();
  const user = await getSession();
  if (!user) return [];

  const profile = await getProfile();

  if (profile?.is_superadmin) {
    const { data: clinics, error } = await supabase.from("clinics").select(CLINIC_COLUMNS);
    if (error) {
      console.error("[session] getUserClinics superadmin full select failed:", error.message);
      const { data: fallbackClinics } = await supabase.from("clinics").select(CLINIC_SHELL_COLUMNS);
      return ((fallbackClinics ?? []) as unknown as Clinic[]).map((clinic) => ({
        id: clinic.id,
        clinic_id: clinic.id,
        user_id: user.id,
        role: "superadmin" as UserRole,
        is_active: true,
        clinic,
      }));
    }
    return ((clinics ?? []) as unknown as Clinic[]).map((clinic) => ({
      id: clinic.id,
      clinic_id: clinic.id,
      user_id: user.id,
      role: "superadmin" as UserRole,
      is_active: true,
      clinic,
    }));
  }

  const { data, error } = await supabase
    .from("clinic_members")
    .select(`${MEMBER_COLUMNS}, clinic:clinics(${CLINIC_COLUMNS})`)
    .eq("user_id", user.id)
    .eq("is_active", true);

  if (!error) {
    return (data ?? []) as unknown as ClinicMember[];
  }

  console.error("[session] getUserClinics join failed:", error.message);

  const { data: members, error: membersError } = await supabase
    .from("clinic_members")
    .select(MEMBER_COLUMNS)
    .eq("user_id", user.id)
    .eq("is_active", true);

  if (membersError) {
    console.error("[session] getUserClinics members fallback failed:", membersError.message);
    return [];
  }

  const memberRows = (members ?? []) as Array<{
    id: string;
    clinic_id: string;
    user_id: string;
    role: UserRole;
    is_active: boolean;
  }>;

  const withFullClinics = await loadClinicsForMembers(supabase, memberRows, CLINIC_COLUMNS);
  if (withFullClinics.some((m) => m.clinic)) {
    return withFullClinics;
  }

  return loadClinicsForMembers(supabase, memberRows, CLINIC_SHELL_COLUMNS);
});

export const getActiveClinicId = cache(async (): Promise<string | null> => {
  const cookieStore = await cookies();
  const clinicId = cookieStore.get(CLINIC_COOKIE)?.value;
  const clinics = await getUserClinics();

  if (clinics.length === 0) return null;
  if (clinicId && clinics.some((c) => c.clinic_id === clinicId)) {
    return clinicId;
  }
  return clinics[0].clinic_id;
});

export const getActiveClinic = cache(async (): Promise<{
  clinic: Clinic | null;
  role: UserRole | null;
  isSuperadmin: boolean;
  memberId: string | null;
}> => {
  const supabase = await createClient();
  const user = await getSession();
  if (!user) return { clinic: null, role: null, isSuperadmin: false, memberId: null };

  const clinics = await getUserClinics();
  const profile = await getProfile();
  const isSuperadmin = profile?.is_superadmin ?? false;
  const clinicId = await getActiveClinicId();
  if (!clinicId) return { clinic: null, role: null, isSuperadmin, memberId: null };

  const membership = clinics.find((m) => m.clinic_id === clinicId);
  let clinic = membership?.clinic ?? null;

  if (!clinic) {
    const { data, error } = await supabase.from("clinics").select(CLINIC_COLUMNS).eq("id", clinicId).single();
    if (!error) {
      clinic = data as Clinic;
    } else {
      const { data: shellClinic } = await supabase
        .from("clinics")
        .select(CLINIC_SHELL_COLUMNS)
        .eq("id", clinicId)
        .single();
      clinic = shellClinic as Clinic | null;
    }
  }

  return {
    clinic: clinic as Clinic | null,
    role: membership?.role ?? (isSuperadmin ? "superadmin" : null),
    isSuperadmin,
    memberId: membership?.id ?? null,
  };
});

export const getPermissionContext = cache(async (): Promise<{
  role: UserRole | null;
  isSuperadmin: boolean;
  permissionOverrides: PermissionOverrides;
}> => {
  const supabase = await createClient();
  const user = await getSession();
  const { role, isSuperadmin, memberId } = await getActiveClinic();

  if (isSuperadmin || !user || !memberId) {
    return { role, isSuperadmin, permissionOverrides: {} };
  }

  const { data } = await supabase
    .from("clinic_member_permissions")
    .select("permission_key, granted")
    .eq("member_id", memberId);

  return {
    role,
    isSuperadmin,
    permissionOverrides: resolveMemberPermissionOverrides(data ?? []),
  };
});

export const getDashboardShell = cache(async () => {
  const [profile, clinics, clinicId, active, permissionContext] = await Promise.all([
    getProfile(),
    getUserClinics(),
    getActiveClinicId(),
    getActiveClinic(),
    getPermissionContext(),
  ]);
  return { profile, clinics, clinicId, ...active, ...permissionContext };
});
