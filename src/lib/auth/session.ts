"use server";

import { cache } from "react";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import type { Clinic, ClinicMember, Profile, UserRole } from "@/types/database";

const CLINIC_COOKIE = "drflow_clinic_id";

export const getSession = cache(async () => {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.user ?? null;
});

export const getProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();
  const user = await getSession();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return data;
});

export const getUserClinics = cache(async (): Promise<ClinicMember[]> => {
  const supabase = await createClient();
  const user = await getSession();
  if (!user) return [];

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_superadmin")
    .eq("id", user.id)
    .single();

  if (profile?.is_superadmin) {
    const { data: clinics } = await supabase.from("clinics").select("*");
    return (clinics ?? []).map((clinic) => ({
      id: clinic.id,
      clinic_id: clinic.id,
      user_id: user.id,
      role: "superadmin" as UserRole,
      is_active: true,
      clinic,
    }));
  }

  const { data } = await supabase
    .from("clinic_members")
    .select("*, clinic:clinics(*)")
    .eq("user_id", user.id)
    .eq("is_active", true);

  return (data ?? []) as ClinicMember[];
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
}> => {
  const supabase = await createClient();
  const user = await getSession();
  if (!user) return { clinic: null, role: null, isSuperadmin: false };

  const clinics = await getUserClinics();
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_superadmin")
    .eq("id", user.id)
    .single();

  const isSuperadmin = profile?.is_superadmin ?? false;
  const clinicId = await getActiveClinicId();
  if (!clinicId) return { clinic: null, role: null, isSuperadmin };

  const membership = clinics.find((m) => m.clinic_id === clinicId);
  const clinic =
    membership?.clinic ??
    (await supabase.from("clinics").select("*").eq("id", clinicId).single()).data;

  return {
    clinic: clinic as Clinic | null,
    role: membership?.role ?? (isSuperadmin ? "superadmin" : null),
    isSuperadmin,
  };
});

/** Una sola llamada para layout + header (menos round-trips por página). */
export const getDashboardShell = cache(async () => {
  const [profile, clinics, clinicId, active] = await Promise.all([
    getProfile(),
    getUserClinics(),
    getActiveClinicId(),
    getActiveClinic(),
  ]);
  return { profile, clinics, clinicId, ...active };
});

export async function setActiveClinic(clinicId: string) {
  const cookieStore = await cookies();
  const clinics = await getUserClinics();
  if (!clinics.some((c) => c.clinic_id === clinicId)) {
    throw new Error("No tenés acceso a esta clínica");
  }
  cookieStore.set(CLINIC_COOKIE, clinicId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });
}

export async function logAudit(params: {
  clinicId?: string;
  entityType: string;
  entityId?: string;
  action: "create" | "update" | "delete" | "view" | "export";
  metadata?: Record<string, unknown>;
}) {
  const supabase = await createClient();
  const user = await getSession();
  if (!user) return;

  await supabase.from("audit_logs").insert({
    clinic_id: params.clinicId,
    user_id: user.id,
    entity_type: params.entityType,
    entity_id: params.entityId,
    action: params.action,
    metadata: params.metadata ?? {},
  });
}
