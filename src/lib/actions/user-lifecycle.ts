"use server";

import { revalidatePath } from "next/cache";

import { requireStaffManagerWithUser } from "@/core/actions/guard-adapters";
import { requireSuperadminOrDeny } from "@/core/entitlements/superadmin-guard.server";
import { resolvePostgresUserMessage } from "@/core/errors/postgres-error";
import { recordAudit } from "@/core/security/audit-service";
import { createAdminClient, hasAdminClient } from "@/core/supabase/admin";
import { createClient } from "@/core/supabase/server";
import { parseEntityId } from "@/core/validations/params";

type LifecycleAction =
  | "deactivate"
  | "reactivate"
  | "unlink"
  | "permanent_delete";

type LifecycleResult = { success: true; message: string } | { error: string };

async function revokeAuthAccess(userId: string, mode: "ban" | "unban" | "delete_sessions") {
  if (!hasAdminClient()) {
    return { error: "Falta SUPABASE_SERVICE_ROLE_KEY para revocar sesiones/login." };
  }
  const admin = createAdminClient();

  if (mode === "ban") {
    const { error } = await admin.auth.admin.updateUserById(userId, {
      ban_duration: "876000h",
    });
    if (error) return { error: error.message };
  }

  if (mode === "unban") {
    const { error } = await admin.auth.admin.updateUserById(userId, {
      ban_duration: "none",
    });
    if (error) return { error: error.message };
  }

  // Global sign-out when available (revokes refresh tokens).
  const authAdmin = admin.auth.admin as typeof admin.auth.admin & {
    signOut?: (id: string, scope?: "global" | "local" | "others") => Promise<{ error: Error | null }>;
  };
  if (typeof authAdmin.signOut === "function") {
    const { error } = await authAdmin.signOut(userId, "global");
    if (error) {
      // Non-fatal if ban already applied.
      if (mode === "unban") return { error: error.message };
    }
  }

  return { ok: true as const };
}

type MemberTarget = {
  id: string;
  user_id: string;
  role: string;
  is_active: boolean | null;
  profiles: unknown;
};

async function loadMemberTarget(
  clinicId: string,
  memberId: string
): Promise<{ data: MemberTarget } | { error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clinic_members")
    .select("id, user_id, role, is_active, profiles(full_name, email)")
    .eq("id", memberId)
    .eq("clinic_id", clinicId)
    .maybeSingle();

  if (error) return { error: error.message };
  if (!data?.user_id) return { error: "Miembro no encontrado" };
  return {
    data: {
      id: data.id,
      user_id: data.user_id,
      role: data.role,
      is_active: data.is_active,
      profiles: data.profiles,
    },
  };
}

function profileMeta(profiles: unknown): { full_name?: string; email?: string; account_status?: string } {
  if (!profiles) return {};
  if (Array.isArray(profiles)) return (profiles[0] as { full_name?: string; email?: string; account_status?: string }) ?? {};
  return profiles as { full_name?: string; email?: string; account_status?: string };
}

async function runLifecycleRpc(
  action: LifecycleAction,
  clinicId: string,
  userId: string
): Promise<{ error?: string; payload?: Record<string, unknown> }> {
  const supabase = await createClient();
  const rpcName =
    action === "deactivate"
      ? "admin_deactivate_clinic_member"
      : action === "reactivate"
        ? "admin_reactivate_clinic_member"
        : action === "unlink"
          ? "admin_unlink_clinic_member"
          : "admin_permanently_delete_clinic_user";

  // Untyped until supabase gen types include 159 RPCs.
  const { data, error } = await (supabase as unknown as {
    rpc: (
      fn: string,
      args: { p_clinic_id: string; p_user_id: string }
    ) => Promise<{ data: unknown; error: { message: string; code?: string } | null }>;
  }).rpc(rpcName, {
    p_clinic_id: clinicId,
    p_user_id: userId,
  });

  if (error) {
    return {
      error: resolvePostgresUserMessage(error, {
        fallback: error.message,
      }),
    };
  }

  return { payload: (data as Record<string, unknown>) ?? undefined };
}

function revalidateLifecyclePaths(clinicId: string) {
  revalidatePath("/configuracion");
  revalidatePath("/ingreso-profesionales");
  revalidatePath("/superadmin");
  revalidatePath(`/superadmin/clinics/${clinicId}`);
}

async function resolveClinicAccess(clinicId?: string): Promise<
  | { ok: true; clinicId: string; via: "staff" | "superadmin" }
  | { ok: false; error: string }
> {
  if (clinicId) {
    const superAccess = await requireSuperadminOrDeny();
    if (superAccess.ok) {
      return { ok: true, clinicId, via: "superadmin" };
    }
  }

  const staff = await requireStaffManagerWithUser();
  if (!staff.ok) return { ok: false, error: staff.error };
  if (clinicId && clinicId !== staff.clinicId) {
    return { ok: false, error: "No tenés permiso sobre esa clínica." };
  }
  return { ok: true, clinicId: staff.clinicId, via: "staff" };
}

export async function deactivateClinicMemberLifecycle(
  memberId: string,
  clinicIdOverride?: string
): Promise<LifecycleResult> {
  const idParsed = parseEntityId(memberId, "Miembro");
  if (!idParsed.ok) return { error: idParsed.error };

  const access = await resolveClinicAccess(clinicIdOverride);
  if (!access.ok) return { error: access.error };

  const target = await loadMemberTarget(access.clinicId, idParsed.data);
  if ("error" in target) return { error: target.error };
  const { data } = target;
  const meta = profileMeta(data.profiles);

  const rpc = await runLifecycleRpc("deactivate", access.clinicId, data.user_id);
  if (rpc.error) return { error: rpc.error };

  const ban = await revokeAuthAccess(data.user_id, "ban");
  if ("error" in ban && ban.error) {
    return {
      error: `Usuario desactivado en clínica, pero no se pudo suspender el login: ${ban.error}`,
    };
  }

  await recordAudit({
    clinicId: access.clinicId,
    module: "settings",
    entityType: "clinic_member",
    entityId: data.id,
    action: "update",
    what: "deactivate_user",
    metadata: {
      user_id: data.user_id,
      email: meta.email,
      via: access.via,
      action: "deactivate",
    },
  });

  revalidateLifecyclePaths(access.clinicId);
  return { success: true, message: `${meta.full_name ?? meta.email ?? "Usuario"} desactivado.` };
}

export async function reactivateClinicMemberLifecycle(
  memberId: string,
  clinicIdOverride?: string
): Promise<LifecycleResult> {
  const idParsed = parseEntityId(memberId, "Miembro");
  if (!idParsed.ok) return { error: idParsed.error };

  const access = await resolveClinicAccess(clinicIdOverride);
  if (!access.ok) return { error: access.error };

  const target = await loadMemberTarget(access.clinicId, idParsed.data);
  if ("error" in target) return { error: target.error };
  const { data } = target;
  const meta = profileMeta(data.profiles);

  const rpc = await runLifecycleRpc("reactivate", access.clinicId, data.user_id);
  if (rpc.error) return { error: rpc.error };

  const unban = await revokeAuthAccess(data.user_id, "unban");
  if ("error" in unban && unban.error) {
    return { error: `Reactivado en clínica, pero no se pudo rehabilitar el login: ${unban.error}` };
  }

  await recordAudit({
    clinicId: access.clinicId,
    module: "settings",
    entityType: "clinic_member",
    entityId: data.id,
    action: "update",
    what: "reactivate_user",
    metadata: {
      user_id: data.user_id,
      email: meta.email,
      via: access.via,
      action: "reactivate",
    },
  });

  revalidateLifecyclePaths(access.clinicId);
  return { success: true, message: `${meta.full_name ?? meta.email ?? "Usuario"} reactivado.` };
}

export async function unlinkClinicMemberLifecycle(
  memberId: string,
  clinicIdOverride?: string
): Promise<LifecycleResult> {
  const idParsed = parseEntityId(memberId, "Miembro");
  if (!idParsed.ok) return { error: idParsed.error };

  const access = await resolveClinicAccess(clinicIdOverride);
  if (!access.ok) return { error: access.error };

  const target = await loadMemberTarget(access.clinicId, idParsed.data);
  if ("error" in target) return { error: target.error };
  const { data } = target;
  const meta = profileMeta(data.profiles);

  const rpc = await runLifecycleRpc("unlink", access.clinicId, data.user_id);
  if (rpc.error) return { error: rpc.error };

  const remaining = Number(rpc.payload?.remaining_active_memberships ?? 0);
  if (remaining === 0) {
    await revokeAuthAccess(data.user_id, "ban");
  }

  await recordAudit({
    clinicId: access.clinicId,
    module: "settings",
    entityType: "clinic_member",
    entityId: data.id,
    action: "delete",
    what: "unlink_user_from_clinic",
    metadata: {
      user_id: data.user_id,
      email: meta.email,
      via: access.via,
      action: "unlink",
      remaining_active_memberships: remaining,
    },
  });

  revalidateLifecyclePaths(access.clinicId);
  return {
    success: true,
    message: `${meta.full_name ?? meta.email ?? "Usuario"} desvinculado de la clínica.`,
  };
}

export async function permanentlyDeleteClinicUserLifecycle(
  memberId: string,
  clinicIdOverride?: string,
  confirmationEmail?: string
): Promise<LifecycleResult> {
  const idParsed = parseEntityId(memberId, "Miembro");
  if (!idParsed.ok) return { error: idParsed.error };

  const access = await resolveClinicAccess(clinicIdOverride);
  if (!access.ok) return { error: access.error };

  const target = await loadMemberTarget(access.clinicId, idParsed.data);
  if ("error" in target) return { error: target.error };
  const { data } = target;
  const meta = profileMeta(data.profiles);

  const expected = (meta.email ?? "").trim().toLowerCase();
  const provided = (confirmationEmail ?? "").trim().toLowerCase();
  if (!expected || provided !== expected) {
    return {
      error: "Confirmación inválida. Escribí el email exacto del usuario para eliminar definitivamente.",
    };
  }

  // Revoke sessions before delete when possible.
  await revokeAuthAccess(data.user_id, "ban");

  const rpc = await runLifecycleRpc("permanent_delete", access.clinicId, data.user_id);
  if (rpc.error) return { error: rpc.error };

  await recordAudit({
    clinicId: access.clinicId,
    module: "settings",
    entityType: "clinic_member",
    entityId: data.id,
    action: "delete",
    what: "permanent_delete_user",
    metadata: {
      user_id: data.user_id,
      email: meta.email,
      full_name: meta.full_name,
      via: access.via,
      action: "permanent_delete",
      email_freed: true,
    },
  });

  revalidateLifecyclePaths(access.clinicId);
  return {
    success: true,
    message: `Cuenta eliminada. El correo ${meta.email} quedó libre para un nuevo registro. La ficha profesional e historia clínica se conservan.`,
  };
}

/** Superadmin: list members for a clinic (includes inactive). */
export async function listClinicMembersForSuperadmin(clinicId: string) {
  const access = await requireSuperadminOrDeny();
  if (!access.ok) return { error: "Solo Superadmin." };

  const idParsed = parseEntityId(clinicId, "Clínica");
  if (!idParsed.ok) return { error: idParsed.error };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clinic_members")
    .select("id, role, is_active, created_at, user_id, profiles(full_name, email)")
    .eq("clinic_id", idParsed.data)
    .order("created_at", { ascending: true });

  if (error) return { error: error.message };
  return { members: data ?? [] };
}
