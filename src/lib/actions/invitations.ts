"use server";

import { revalidatePath } from "next/cache";
import { requireStaffManagerAccess } from "@/core/services/staff-access.service";
import { inviteSchema } from "@/core/validations/staff-schemas";
import { createAdminClient, hasAdminClient } from "@/core/supabase/admin";
import { createClient } from "@/core/supabase/server";
import { getPublicSiteUrl } from "@/core/supabase/env";
import { recordAudit, recordAuditChange } from "@/core/security/audit-service";
import type { UserRole } from "@/types/database";
import { parseEntityId, staffRoleSchema } from "@/core/validations/params";

async function requireStaffManager() {
  const access = await requireStaffManagerAccess();
  if (!access.ok) return { error: access.error };
  return { user: access.user, clinicId: access.clinicId };
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
        "El servidor no está configurado para enviar invitaciones por email. Contactá al administrador del sistema.",
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
    const { error: memberErr } = await supabase.rpc(
      "accept_clinic_invitation_for_existing_user",
      {
        p_clinic_id: clinicId,
        p_user_id: existingUserId,
        p_email: email,
        p_role: parsed.data.role,
      }
    );

    if (memberErr) return { error: memberErr.message };

    await recordAudit({
      clinicId,
      module: "settings",
      entityType: "clinic_member",
      entityId: existingUserId,
      action: "create",
      metadata: { email, role: parsed.data.role, via: "existing_user" },
    });

    revalidatePath("/configuracion");
    return {
      success: true,
      message: `${parsed.data.full_name} ya tenía cuenta y fue agregado al equipo.`,
    };
  }

  const siteUrl = getPublicSiteUrl();
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

  await recordAudit({
    clinicId,
    module: "settings",
    entityType: "clinic_invitation",
    action: "create",
    metadata: { email, role: parsed.data.role, full_name: parsed.data.full_name },
  });

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

  const idParsed = parseEntityId(invitationId, "Invitación");
  if (!idParsed.ok) return { error: idParsed.error };

  const supabase = await createClient();
  const { data: invitation } = await supabase
    .from("clinic_invitations")
    .select("email, role")
    .eq("id", idParsed.data)
    .eq("clinic_id", clinicId)
    .eq("status", "pending")
    .maybeSingle();

  const { error } = await supabase
    .from("clinic_invitations")
    .update({ status: "revoked" })
    .eq("id", idParsed.data)
    .eq("clinic_id", clinicId)
    .eq("status", "pending");

  if (error) return { error: error.message };

  await recordAudit({
    clinicId,
    module: "settings",
    entityType: "clinic_invitation",
    entityId: idParsed.data,
    action: "delete",
    metadata: invitation ? { email: invitation.email, role: invitation.role } : undefined,
  });

  revalidatePath("/configuracion");
  return { success: true };
}

export async function updateClinicMemberRole(memberId: string, role: UserRole) {
  const access = await requireStaffManager();
  if ("error" in access && access.error) return { error: access.error };
  const { clinicId, user } = access;

  const idParsed = parseEntityId(memberId, "Miembro");
  if (!idParsed.ok) return { error: idParsed.error };

  const roleParsed = staffRoleSchema.safeParse(role);
  if (!roleParsed.success) return { error: "Rol inválido" };

  const supabase = await createClient();
  const { data: target } = await supabase
    .from("clinic_members")
    .select("user_id, role")
    .eq("id", idParsed.data)
    .eq("clinic_id", clinicId)
    .single();

  if (!target) return { error: "Miembro no encontrado" };
  if (target.user_id === user!.id) return { error: "No podés cambiar tu propio rol acá." };

  const { error } = await supabase
    .from("clinic_members")
    .update({ role: roleParsed.data, updated_at: new Date().toISOString() })
    .eq("id", idParsed.data)
    .eq("clinic_id", clinicId);

  if (error) return { error: error.message };

  await recordAuditChange({
    clinicId,
    module: "settings",
    entityType: "clinic_member",
    entityId: idParsed.data,
    action: "update",
    before: { role: target.role },
    after: { role: roleParsed.data },
    keys: ["role"],
  });

  revalidatePath("/configuracion");
  return { success: true };
}

export async function deactivateClinicMember(memberId: string) {
  const access = await requireStaffManager();
  if ("error" in access && access.error) return { error: access.error };
  const { clinicId, user } = access;

  const idParsed = parseEntityId(memberId, "Miembro");
  if (!idParsed.ok) return { error: idParsed.error };

  const supabase = await createClient();
  const { data: target } = await supabase
    .from("clinic_members")
    .select("user_id, role, is_active")
    .eq("id", idParsed.data)
    .eq("clinic_id", clinicId)
    .single();

  if (!target) return { error: "Miembro no encontrado" };
  if (target.user_id === user!.id) return { error: "No podés desactivarte a vos mismo." };

  const { error } = await supabase
    .from("clinic_members")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", idParsed.data)
    .eq("clinic_id", clinicId);

  if (error) return { error: error.message };

  await recordAuditChange({
    clinicId,
    module: "settings",
    entityType: "clinic_member",
    entityId: idParsed.data,
    action: "update",
    before: { is_active: target.is_active },
    after: { is_active: false },
    keys: ["is_active"],
    metadata: { user_id: target.user_id },
  });

  if (hasAdminClient()) {
    const admin = createAdminClient();
    const { error: banError } = await admin.auth.admin.updateUserById(target.user_id, {
      ban_duration: "876000h",
    });
    if (banError) {
      return {
        error: `Usuario desactivado en la clínica, pero no se pudo suspender el login: ${banError.message}`,
      };
    }
  }

  revalidatePath("/configuracion");
  return { success: true };
}

export async function removeClinicMemberPermanently(memberId: string) {
  const access = await requireStaffManager();
  if ("error" in access && access.error) return { error: access.error };
  const { clinicId, user } = access;

  const idParsed = parseEntityId(memberId, "Miembro");
  if (!idParsed.ok) return { error: idParsed.error };

  const supabase = await createClient();
  const { data: target } = await supabase
    .from("clinic_members")
    .select("user_id, profiles(full_name, email)")
    .eq("id", idParsed.data)
    .eq("clinic_id", clinicId)
    .single();

  if (!target?.user_id) return { error: "Miembro no encontrado" };
  if (target.user_id === user!.id) return { error: "No podés eliminarte a vos mismo." };

  const { error } = await supabase.rpc("remove_clinic_member_user", {
    p_clinic_id: clinicId,
    p_user_id: target.user_id,
  });

  if (error) {
    if (error.message.includes("remove_clinic_member_user")) {
      return {
        error:
          "Ejecutá las migraciones 035 y 036 en Supabase SQL Editor y volvé a intentar.",
      };
    }
    return { error: error.message };
  }

  await recordAudit({
    clinicId,
    module: "settings",
    entityType: "clinic_member",
    entityId: idParsed.data,
    action: "delete",
    metadata: {
      user_id: target.user_id,
      email: (() => {
        const p = target.profiles as { email?: string } | { email?: string }[] | null;
        return Array.isArray(p) ? p[0]?.email : p?.email;
      })(),
    },
  });

  revalidatePath("/configuracion");
  return { success: true };
}
