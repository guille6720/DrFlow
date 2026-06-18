"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getActiveClinic, getActiveClinicId, getSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions/roles";
import { createAdminClient, hasAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/supabase/env";
import type { UserRole } from "@/types/database";

const inviteSchema = z.object({
  email: z.string().email("Email inválido"),
  full_name: z.string().min(2, "Nombre requerido"),
  role: z.enum(["clinic_admin", "doctor", "secretary"]),
});

async function requireStaffManager() {
  const user = await getSession();
  const clinicId = await getActiveClinicId();
  const { role, isSuperadmin } = await getActiveClinic();
  if (!user || !clinicId) return { error: "Sesión requerida" as const };
  if (!hasPermission(role, "manageStaff", isSuperadmin)) {
    return { error: "Solo administradores pueden gestionar el equipo" as const };
  }
  return { user, clinicId };
}

export async function acceptPendingInvitations() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_clinic_invitations_for_user");
  if (error) {
    if (error.message.includes("accept_clinic_invitations")) {
      return { error: "Ejecutá la migración 018 en Supabase SQL Editor." };
    }
    return { error: error.message };
  }
  return { accepted: (data as number) ?? 0 };
}

async function findAuthUserIdByEmail(email: string): Promise<string | null> {
  if (!hasAdminClient()) return null;
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) return null;
  const match = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  return match?.id ?? null;
}

export async function inviteClinicMember(formData: FormData) {
  const access = await requireStaffManager();
  if ("error" in access && access.error) return { error: access.error };
  const { user, clinicId } = access;

  const parsed = inviteSchema.safeParse({
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    full_name: String(formData.get("full_name") ?? "").trim(),
    role: String(formData.get("role") ?? ""),
  });

  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  if (parsed.data.email === user!.email?.toLowerCase()) {
    return { error: "No podés invitarte a vos mismo." };
  }

  if (!hasAdminClient()) {
    return {
      error:
        "Falta SUPABASE_SERVICE_ROLE_KEY en .env.local para enviar invitaciones por email. " +
        "Project Settings → API → service_role.",
    };
  }

  const supabase = await createClient();
  const admin = createAdminClient();
  const email = parsed.data.email;

  const { data: profileRow } = await supabase
    .from("profiles")
    .select("id")
    .ilike("email", email)
    .maybeSingle();

  if (profileRow) {
    const { data: existingMember } = await supabase
      .from("clinic_members")
      .select("id")
      .eq("clinic_id", clinicId)
      .eq("user_id", profileRow.id)
      .eq("is_active", true)
      .maybeSingle();

    if (existingMember) {
      return { error: "Ese usuario ya pertenece a la clínica." };
    }
  }

  const { error: invErr } = await supabase.from("clinic_invitations").upsert(
    {
      clinic_id: clinicId,
      email,
      full_name: parsed.data.full_name,
      role: parsed.data.role as UserRole,
      invited_by: user!.id,
      status: "pending",
    },
    { onConflict: "clinic_id,email" }
  );

  if (invErr) {
    if (invErr.message.includes("clinic_invitations")) {
      return { error: "Ejecutá la migración 018 en Supabase SQL Editor." };
    }
    return { error: invErr.message };
  }

  const existingUserId = await findAuthUserIdByEmail(email);

  if (existingUserId) {
    const { error: memberErr } = await admin.from("clinic_members").upsert(
      {
        clinic_id: clinicId,
        user_id: existingUserId,
        role: parsed.data.role,
        is_active: true,
      },
      { onConflict: "clinic_id,user_id" }
    );

    if (memberErr) return { error: memberErr.message };

    await supabase
      .from("clinic_invitations")
      .update({ status: "accepted", accepted_at: new Date().toISOString() })
      .eq("clinic_id", clinicId)
      .eq("email", email);

    revalidatePath("/configuracion");
    return {
      success: true,
      message: `${parsed.data.full_name} ya tenía cuenta y fue agregado al equipo.`,
    };
  }

  const siteUrl = getSiteUrl();
  const { error: authErr } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: parsed.data.full_name },
    redirectTo: `${siteUrl}/auth/callback?next=/login/restablecer`,
  });

  if (authErr) {
    return {
      error:
        authErr.message.includes("already")
          ? "El email ya está registrado. El usuario puede iniciar sesión y se vinculará automáticamente."
          : authErr.message,
    };
  }

  revalidatePath("/configuracion");
  return {
    success: true,
    message: `Invitación enviada a ${email}. Revisá spam si no llega en unos minutos.`,
  };
}

export async function revokeClinicInvitation(invitationId: string) {
  const access = await requireStaffManager();
  if ("error" in access && access.error) return { error: access.error };
  const { clinicId } = access;

  const supabase = await createClient();
  const { error } = await supabase
    .from("clinic_invitations")
    .update({ status: "revoked" })
    .eq("id", invitationId)
    .eq("clinic_id", clinicId)
    .eq("status", "pending");

  if (error) return { error: error.message };
  revalidatePath("/configuracion");
  return { success: true };
}

export async function updateClinicMemberRole(memberId: string, role: UserRole) {
  const access = await requireStaffManager();
  if ("error" in access && access.error) return { error: access.error };
  const { clinicId, user } = access;

  if (!["clinic_admin", "doctor", "secretary"].includes(role)) {
    return { error: "Rol inválido" };
  }

  const supabase = await createClient();
  const { data: target } = await supabase
    .from("clinic_members")
    .select("user_id")
    .eq("id", memberId)
    .eq("clinic_id", clinicId)
    .single();

  if (!target) return { error: "Miembro no encontrado" };
  if (target.user_id === user!.id) return { error: "No podés cambiar tu propio rol acá." };

  const { error } = await supabase
    .from("clinic_members")
    .update({ role, updated_at: new Date().toISOString() })
    .eq("id", memberId)
    .eq("clinic_id", clinicId);

  if (error) return { error: error.message };
  revalidatePath("/configuracion");
  return { success: true };
}

export async function deactivateClinicMember(memberId: string) {
  const access = await requireStaffManager();
  if ("error" in access && access.error) return { error: access.error };
  const { clinicId, user } = access;

  const supabase = await createClient();
  const { data: target } = await supabase
    .from("clinic_members")
    .select("user_id")
    .eq("id", memberId)
    .eq("clinic_id", clinicId)
    .single();

  if (!target) return { error: "Miembro no encontrado" };
  if (target.user_id === user!.id) return { error: "No podés desactivarte a vos mismo." };

  const { error } = await supabase
    .from("clinic_members")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", memberId)
    .eq("clinic_id", clinicId);

  if (error) return { error: error.message };
  revalidatePath("/configuracion");
  return { success: true };
}
