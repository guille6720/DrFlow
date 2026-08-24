"use server";

import { revalidatePath } from "next/cache";

import { requireStaffManagerWithUser } from "@/core/actions/guard-adapters";
import { FEATURES } from "@/core/entitlements/features";
import { assertClinicSeatCapacity } from "@/core/entitlements/limits.server";
import { resolvePostgresUserMessage } from "@/core/errors/postgres-error";
import { recordAudit, recordAuditChange } from "@/core/security/audit-service";
import { createAdminClient, hasAdminClient } from "@/core/supabase/admin";
import { createClient } from "@/core/supabase/server";
import { firstZodIssue, parseEntityId, staffRoleSchema } from "@/core/validations/params";
import { inviteSchema } from "@/core/validations/staff-schemas";

import {
  buildClinicInviteEmailContent,
  formatEmailSendError,
  sendTransactionalEmail,
} from "@/lib/services/transactional-email";
import { generateInitialPassword } from "@/lib/utils/generate-initial-password";
import { invitationCredentialsPath } from "@/lib/utils/invitation-credentials-path";
import type { UserRole } from "@/types/database";

async function requireStaffManager() {
  return requireStaffManagerWithUser();
}

export async function acceptPendingInvitations() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_clinic_invitations_for_user");
  if (error) {
    return {
      error: resolvePostgresUserMessage(error, { fallback: error.message }),
    };
  }
  return { accepted: (data as number) ?? 0 };
}

async function findAuthUserIdByEmail(email: string): Promise<string | null> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;

  if (hasAdminClient()) {
    const admin = createAdminClient();
    const { data: profileRow } = await admin
      .from("profiles")
      .select("id")
      .ilike("email", normalized)
      .maybeSingle();
    if (profileRow?.id) return profileRow.id;

    const { data: authData, error } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    if (!error) {
      const match = authData.users.find(
        (user) => user.email?.trim().toLowerCase() === normalized
      );
      if (match?.id) return match.id;
    }
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id")
    .ilike("email", normalized)
    .maybeSingle();
  return data?.id ?? null;
}

type InviteMemberResult =
  | { success: true; message: string; credentialsPath: string }
  | { error: string };

async function linkInvitedUserToClinic(input: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  admin: ReturnType<typeof createAdminClient>;
  clinicId: string;
  userId: string;
  email: string;
  role: UserRole;
  fullName: string;
  initialPassword: string;
  credentialsPath: string;
  via: "existing_user" | "recovered_user" | "new_user";
}): Promise<InviteMemberResult> {
  const {
    supabase,
    admin,
    clinicId,
    userId,
    email,
    role,
    fullName,
    initialPassword,
    credentialsPath,
    via,
  } = input;

  const { error: memberErr } = await supabase.rpc("accept_clinic_invitation_for_existing_user", {
    p_clinic_id: clinicId,
    p_user_id: userId,
    p_email: email,
    p_role: role,
  });

  if (memberErr) return { error: memberErr.message };

  await admin.auth.admin.updateUserById(userId, {
    password: initialPassword,
    email_confirm: true,
    ban_duration: "none",
  });

  const { data: clinicRow } = await supabase
    .from("clinics")
    .select("name")
    .eq("id", clinicId)
    .maybeSingle();

  const emailContent = buildClinicInviteEmailContent({
    fullName,
    clinicName: clinicRow?.name ?? "tu consultorio",
    email,
    password: initialPassword,
    credentialsPath,
  });
  const emailResult = await sendTransactionalEmail({
    to: email,
    subject: emailContent.subject,
    text: emailContent.text,
  });

  await recordAudit({
    clinicId,
    module: "settings",
    entityType: via === "new_user" ? "clinic_invitation" : "clinic_member",
    entityId: userId,
    action: "create",
    metadata: { email, role, full_name: fullName, via },
  });

  revalidatePath("/configuracion");
  revalidatePath("/ingreso-profesionales");

  const linkedMessage =
    via === "existing_user" || via === "recovered_user"
      ? `${fullName} ya tenía cuenta y fue agregado al equipo.`
      : `Usuario creado para ${email}.`;

  return {
    success: true as const,
    message: emailResult.sent
      ? `${linkedMessage} Se enviaron las credenciales por email.`
      : `${linkedMessage} Compartí el enlace de credenciales con la persona invitada.`,
    credentialsPath,
  };
}

export async function inviteClinicMember(formData: FormData): Promise<InviteMemberResult> {
  const access = await requireStaffManager();
  if (!access.ok) return { error: access.error };
  const { user, clinicId } = access;

  const parsed = inviteSchema.safeParse({
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    full_name: String(formData.get("full_name") ?? "").trim(),
    role: String(formData.get("role") ?? ""),
  });

  if (!parsed.success) return { error: firstZodIssue(parsed.error) };

  const seat = await assertClinicSeatCapacity({
    clinicId,
    featureKey: FEATURES.USERS_MAX,
  });
  if (!seat.ok) return { error: seat.error };

  const initialPassword = generateInitialPassword();

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

  const { data: invitationRow, error: invErr } = await supabase
    .from("clinic_invitations")
    .upsert(
      {
        clinic_id: clinicId,
        email,
        full_name: parsed.data.full_name,
        role: parsed.data.role as UserRole,
        invited_by: user!.id,
        status: "pending",
        initial_password: initialPassword,
      },
      { onConflict: "clinic_id,email" }
    )
    .select("id")
    .single();

  if (invErr || !invitationRow?.id) {
    return {
      error: resolvePostgresUserMessage(invErr, {
        fallback: invErr?.message ?? "No se pudo registrar la invitación.",
      }),
    };
  }

  const credentialsPath = invitationCredentialsPath(invitationRow.id);

  const existingUserId = await findAuthUserIdByEmail(email);

  if (existingUserId) {
    return linkInvitedUserToClinic({
      supabase,
      admin,
      clinicId,
      userId: existingUserId,
      email,
      role: parsed.data.role as UserRole,
      fullName: parsed.data.full_name,
      initialPassword,
      credentialsPath,
      via: "existing_user",
    });
  }

  const { data: createdUser, error: authErr } = await admin.auth.admin.createUser({
    email,
    password: initialPassword,
    email_confirm: true,
    user_metadata: { full_name: parsed.data.full_name },
  });

  if (authErr) {
    if (authErr.message.toLowerCase().includes("already")) {
      const recoveredUserId = await findAuthUserIdByEmail(email);
      if (recoveredUserId) {
        return linkInvitedUserToClinic({
          supabase,
          admin,
          clinicId,
          userId: recoveredUserId,
          email,
          role: parsed.data.role as UserRole,
          fullName: parsed.data.full_name,
          initialPassword,
          credentialsPath,
          via: "recovered_user",
        });
      }
    }

    return {
      error:
        authErr.message.includes("already")
          ? "El email ya está registrado pero no pudimos vincularlo. Contactá soporte o probá reenviar la invitación."
          : authErr.message,
    };
  }

  const newUserId = createdUser.user?.id;
  if (!newUserId) {
    return { error: "No se pudo crear el usuario de acceso." };
  }

  return linkInvitedUserToClinic({
    supabase,
    admin,
    clinicId,
    userId: newUserId,
    email,
    role: parsed.data.role as UserRole,
    fullName: parsed.data.full_name,
    initialPassword,
    credentialsPath,
    via: "new_user",
  });
}

export async function updateClinicMemberProfile(memberId: string, formData: FormData) {
  const access = await requireStaffManager();
  if (!access.ok) return { error: access.error };
  const { clinicId, user } = access;

  const idParsed = parseEntityId(memberId, "Miembro");
  if (!idParsed.ok) return { error: idParsed.error };

  const fullName = String(formData.get("full_name") ?? "").trim();
  if (fullName.length < 2) return { error: "Nombre requerido" };

  const supabase = await createClient();
  const { data: target } = await supabase
    .from("clinic_members")
    .select("user_id")
    .eq("id", idParsed.data)
    .eq("clinic_id", clinicId)
    .single();

  if (!target?.user_id) return { error: "Miembro no encontrado" };

  if (!hasAdminClient()) {
    return { error: "No se puede actualizar el perfil sin SUPABASE_SERVICE_ROLE_KEY." };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ full_name: fullName, updated_at: new Date().toISOString() })
    .eq("id", target.user_id);

  if (error) return { error: error.message };

  await recordAuditChange({
    clinicId,
    module: "settings",
    entityType: "clinic_member",
    entityId: idParsed.data,
    action: "update",
    before: {},
    after: { full_name: fullName },
    keys: ["full_name"],
    metadata: { updated_by: user!.id, user_id: target.user_id },
  });

  revalidatePath("/configuracion");
  revalidatePath("/ingreso-profesionales");
  return { success: true, message: "Datos del usuario actualizados." };
}

export async function updateClinicMemberPassword(memberId: string, formData: FormData) {
  const access = await requireStaffManager();
  if (!access.ok) return { error: access.error };
  const { clinicId, user } = access;

  const idParsed = parseEntityId(memberId, "Miembro");
  if (!idParsed.ok) return { error: idParsed.error };

  const password = String(formData.get("password") ?? "").trim();
  if (password.length < 8) {
    return { error: "La contraseña debe tener al menos 8 caracteres." };
  }

  if (!hasAdminClient()) {
    return { error: "No se puede actualizar la contraseña sin SUPABASE_SERVICE_ROLE_KEY." };
  }

  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: target } = await supabase
    .from("clinic_members")
    .select("user_id, profiles(email)")
    .eq("id", idParsed.data)
    .eq("clinic_id", clinicId)
    .single();

  if (!target?.user_id) return { error: "Miembro no encontrado" };
  if (target.user_id === user!.id) {
    return { error: "Cambiá tu propia contraseña desde Configuración de cuenta." };
  }

  const profileEmail = (() => {
    const p = target.profiles as { email?: string } | { email?: string }[] | null;
    return Array.isArray(p) ? p[0]?.email : p?.email;
  })();

  const { error: authError } = await admin.auth.admin.updateUserById(target.user_id, {
    password,
  });
  if (authError) return { error: authError.message };

  if (profileEmail) {
    await supabase
      .from("clinic_invitations")
      .update({ initial_password: password })
      .eq("clinic_id", clinicId)
      .ilike("email", profileEmail);
  }

  await recordAuditChange({
    clinicId,
    module: "settings",
    entityType: "clinic_member",
    entityId: idParsed.data,
    action: "update",
    before: {},
    after: { password_reset: true },
    keys: ["password_reset"],
    metadata: { updated_by: user!.id, user_id: target.user_id },
  });

  revalidatePath("/configuracion");
  revalidatePath("/ingreso-profesionales");
  return { success: true, message: "Contraseña actualizada y guardada para referencia del consultorio." };
}

export async function resendClinicMemberInviteEmail(memberId: string) {
  const access = await requireStaffManager();
  if (!access.ok) return { error: access.error };
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
  if (target.user_id === user!.id) {
    return { error: "No podés reenviarte credenciales a vos mismo." };
  }

  const profile = (() => {
    const p = target.profiles as { full_name?: string; email?: string } | { full_name?: string; email?: string }[] | null;
    return Array.isArray(p) ? p[0] : p;
  })();

  const email = profile?.email?.trim().toLowerCase();
  if (!email) return { error: "El usuario no tiene email de acceso." };

  const { data: invitation } = await supabase
    .from("clinic_invitations")
    .select("id, full_name, initial_password")
    .eq("clinic_id", clinicId)
    .ilike("email", email)
    .maybeSingle();

  const password = invitation?.initial_password?.trim();
  if (!password) {
    return {
      error:
        "No hay contraseña registrada para este usuario. Restablecela abajo y volvé a reenviar el mail.",
    };
  }

  const { data: clinicRow } = await supabase
    .from("clinics")
    .select("name")
    .eq("id", clinicId)
    .maybeSingle();

  const fullName =
    profile?.full_name?.trim() || invitation?.full_name?.trim() || email;

  const emailContent = buildClinicInviteEmailContent({
    fullName,
    clinicName: clinicRow?.name ?? "tu consultorio",
    email,
    password,
    credentialsPath: invitation?.id ? invitationCredentialsPath(invitation.id) : undefined,
  });

  const emailResult = await sendTransactionalEmail({
    to: email,
    subject: emailContent.subject,
    text: emailContent.text,
  });

  if (!emailResult.sent) {
    return { error: `No se pudo enviar el email: ${formatEmailSendError(emailResult.reason)}` };
  }

  await recordAudit({
    clinicId,
    module: "settings",
    entityType: "clinic_member",
    entityId: idParsed.data,
    action: "update",
    metadata: { email, resent_invite: true, provider: emailResult.provider },
  });

  revalidatePath("/configuracion");
  revalidatePath("/ingreso-profesionales");
  return {
    success: true,
    message: `Credenciales reenviadas a ${email}. Revisá spam si no llega en unos minutos.`,
  };
}

export async function revokeClinicInvitation(invitationId: string) {
  const access = await requireStaffManager();
  if (!access.ok) return { error: access.error };
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
  revalidatePath("/ingreso-profesionales");
  return { success: true };
}

export async function updateClinicMemberRole(memberId: string, role: UserRole) {
  const access = await requireStaffManager();
  if (!access.ok) return { error: access.error };
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
  revalidatePath("/ingreso-profesionales");
  return { success: true };
}

/** Re-enable login + clinic membership for an invited team member (e.g. after a bad invite/login). */
export async function restoreClinicMemberLoginAccess(memberId: string) {
  const access = await requireStaffManager();
  if (!access.ok) return { error: access.error };
  const { clinicId } = access;

  const idParsed = parseEntityId(memberId, "Miembro");
  if (!idParsed.ok) return { error: idParsed.error };

  if (!hasAdminClient()) {
    return { error: "No se puede restablecer el acceso sin SUPABASE_SERVICE_ROLE_KEY." };
  }

  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: target } = await supabase
    .from("clinic_members")
    .select("user_id, role, is_active, profiles(email)")
    .eq("id", idParsed.data)
    .eq("clinic_id", clinicId)
    .maybeSingle();

  if (!target?.user_id) return { error: "Miembro no encontrado" };

  const { error: memberError } = await supabase
    .from("clinic_members")
    .update({ is_active: true, updated_at: new Date().toISOString() })
    .eq("id", idParsed.data)
    .eq("clinic_id", clinicId);

  if (memberError) return { error: memberError.message };

  const { error: authError } = await admin.auth.admin.updateUserById(target.user_id, {
    ban_duration: "none",
    email_confirm: true,
  });

  if (authError) {
    return { error: `No se pudo restablecer el login: ${authError.message}` };
  }

  await recordAudit({
    clinicId,
    module: "settings",
    entityType: "clinic_member",
    entityId: idParsed.data,
    action: "update",
    metadata: { user_id: target.user_id, reason: "restore_login_access" },
  });

  revalidatePath("/configuracion");
  revalidatePath("/ingreso-profesionales");
  return { success: true, message: "Acceso restablecido. La persona ya puede ingresar al dashboard." };
}

export async function deactivateClinicMember(memberId: string) {
  const access = await requireStaffManager();
  if (!access.ok) return { error: access.error };
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
  revalidatePath("/ingreso-profesionales");
  return { success: true };
}

export async function removeClinicMemberPermanently(memberId: string) {
  const access = await requireStaffManager();
  if (!access.ok) return { error: access.error };
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
    return {
      error: resolvePostgresUserMessage(error, { fallback: error.message }),
    };
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
  revalidatePath("/ingreso-profesionales");
  return { success: true };
}
