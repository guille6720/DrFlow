"use server";

import { revalidatePath } from "next/cache";

import { requireStaffManagerWithUser } from "@/core/actions/guard-adapters";
import { requireAddonFeatureAccess } from "@/core/entitlements/entitlements.server";
import { FEATURES } from "@/core/entitlements/features";
import {
  computeOverrideOnToggle,
  isManageablePermissionKey,
  MANAGEABLE_PERMISSION_KEYS,
  type ManageablePermissionKey,
} from "@/core/permissions/member-permissions";
import {
  buildRoleChanges,
  buildRoleOverrides,
  isEditableRole,
  type RolePermissionOverrides,
} from "@/core/permissions/role-permissions";
import { asStagingSchemaClient } from "@/core/products/staging-schema-client";
import { recordAudit } from "@/core/security/audit-service";
import { createClient } from "@/core/supabase/server";
import { parseEntityId } from "@/core/validations/params";

import type { UserRole } from "@/types/database";

async function requireTeamAdmin() {
  return requireStaffManagerWithUser();
}

async function loadRoleOverrides(clinicId: string): Promise<RolePermissionOverrides> {
  try {
    const supabase = asStagingSchemaClient(await createClient());
    const { data, error } = await supabase
      .from("clinic_role_permissions")
      .select("role, permission_key, granted")
      .eq("clinic_id", clinicId);
    if (error) return {};
    return buildRoleOverrides(data as unknown as { role: string; permission_key: string; granted: boolean }[]);
  } catch {
    return {};
  }
}

export async function updateClinicMemberPermission(
  memberIdRaw: string,
  permissionKeyRaw: string,
  granted: boolean
): Promise<{ error?: string }> {
  const access = await requireTeamAdmin();
  if (!access.ok) return { error: access.error };

  const memberIdParsed = parseEntityId(memberIdRaw);
  if (!memberIdParsed.ok) return { error: memberIdParsed.error };
  const memberId = memberIdParsed.data;
  if (!isManageablePermissionKey(permissionKeyRaw)) {
    return { error: "Permiso inválido" };
  }

  const supabase = await createClient();
  const { data: member, error: memberError } = await supabase
    .from("clinic_members")
    .select("id, role, clinic_id")
    .eq("id", memberId)
    .eq("clinic_id", access.clinicId)
    .maybeSingle();

  if (memberError || !member) return { error: "Miembro no encontrado" };
  if (member.role === "clinic_admin" || member.role === "superadmin") {
    return { error: "No podés modificar permisos del administrador" };
  }

  const roleOverrides = await loadRoleOverrides(access.clinicId);
  const overrideValue = computeOverrideOnToggle(
    member.role as UserRole,
    permissionKeyRaw,
    granted,
    roleOverrides
  );

  if (overrideValue === null) {
    const { error } = await supabase
      .from("clinic_member_permissions")
      .delete()
      .eq("member_id", memberId)
      .eq("permission_key", permissionKeyRaw);

    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from("clinic_member_permissions").upsert(
      {
        clinic_id: access.clinicId,
        member_id: memberId,
        permission_key: permissionKeyRaw,
        granted: overrideValue,
        updated_by: access.user!.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "member_id,permission_key" }
    );

    if (error) return { error: error.message };
  }

  await recordAudit({
    clinicId: access.clinicId,
    module: "settings",
    entityType: "clinic_member_permission",
    entityId: memberId,
    action: "update",
    metadata: {
      permission_key: permissionKeyRaw,
      granted: overrideValue ?? "role_default",
      member_role: member.role,
    },
  });

  revalidatePath("/configuracion");
  return {};
}

const ROLE_RPC_ERRORS: Record<string, string> = {
  FORBIDDEN: "Solo el administrador de la clínica puede cambiar permisos por rol.",
  INVALID_ROLE: "Rol inválido.",
  INVALID_PERMISSION: "Permiso inválido.",
  EMPTY_CHANGES: "No hay cambios para guardar.",
};

function mapRoleRpcError(message: string | undefined): string {
  const msg = message ?? "";
  if (/clinic_role_permissions|set_clinic_role_permissions|does not exist|schema cache/i.test(msg)) {
    return "Los permisos por rol todavía no están disponibles en esta base de datos.";
  }
  for (const [code, text] of Object.entries(ROLE_RPC_ERRORS)) {
    if (msg.includes(code)) return text;
  }
  return "No se pudieron guardar los permisos del rol.";
}

/** Sets one or many permissions (a whole module group) for a role inside the active clinic. */
export async function updateClinicRolePermissions(
  roleRaw: string,
  permissionKeys: string[],
  granted: boolean
): Promise<{ error?: string }> {
  const access = await requireTeamAdmin();
  if (!access.ok) return { error: access.error };
  if (!isEditableRole(roleRaw)) return { error: "Rol inválido" };
  if (!Array.isArray(permissionKeys) || permissionKeys.length === 0 || permissionKeys.length > 32) {
    return { error: "Permiso inválido" };
  }
  if (!permissionKeys.every((k) => isManageablePermissionKey(k))) return { error: "Permiso inválido" };

  const changes = buildRoleChanges(roleRaw, permissionKeys, granted);
  const supabase = asStagingSchemaClient(await createClient());
  const { error } = await supabase.rpc("set_clinic_role_permissions", {
    p_clinic_id: access.clinicId,
    p_role: roleRaw,
    p_changes: changes,
  });
  if (error) return { error: mapRoleRpcError(error.message) };

  revalidatePath("/configuracion");
  return {};
}

/** Back to the application defaults for a role (removes every clinic role row). */
export async function resetClinicRolePermissions(roleRaw: string): Promise<{ error?: string }> {
  const access = await requireTeamAdmin();
  if (!access.ok) return { error: access.error };
  if (!isEditableRole(roleRaw)) return { error: "Rol inválido" };

  const changes = Object.fromEntries(MANAGEABLE_PERMISSION_KEYS.map((k) => [k, null]));
  const supabase = asStagingSchemaClient(await createClient());
  const { error } = await supabase.rpc("set_clinic_role_permissions", {
    p_clinic_id: access.clinicId,
    p_role: roleRaw,
    p_changes: changes,
  });
  if (error) return { error: mapRoleRpcError(error.message) };

  revalidatePath("/configuracion");
  return {};
}

export async function updateClinicMemberUsesSharedAi(
  memberIdRaw: string,
  usesSharedAi: boolean
): Promise<{ error?: string }> {
  const access = await requireTeamAdmin();
  if (!access.ok) return { error: access.error };

  if (usesSharedAi) {
    const entitlement = await requireAddonFeatureAccess(FEATURES.AI);
    if (!entitlement.ok) return { error: entitlement.error };
  }

  const memberIdParsed = parseEntityId(memberIdRaw);
  if (!memberIdParsed.ok) return { error: memberIdParsed.error };
  const memberId = memberIdParsed.data;

  const supabase = await createClient();
  const { data: member, error: memberError } = await supabase
    .from("clinic_members")
    .select("id, role")
    .eq("id", memberId)
    .eq("clinic_id", access.clinicId)
    .maybeSingle();

  if (memberError || !member) return { error: "Miembro no encontrado" };
  if (member.role === "clinic_admin") {
    return { error: "El administrador usa sus propias credenciales" };
  }

  const { error } = await supabase
    .from("clinic_members")
    .update({ uses_shared_ai: usesSharedAi })
    .eq("id", memberId)
    .eq("clinic_id", access.clinicId);

  if (error) return { error: error.message };

  await recordAudit({
    clinicId: access.clinicId,
    module: "settings",
    entityType: "clinic_member",
    entityId: memberId,
    action: "update",
    metadata: { uses_shared_ai: usesSharedAi },
  });

  revalidatePath("/configuracion");
  return {};
}

export type TeamPermissionMember = {
  id: string;
  role: UserRole;
  uses_shared_ai: boolean;
  profiles?: { full_name: string; email: string } | null;
};

export type TeamPermissionsPanelData = {
  members: TeamPermissionMember[];
  permissionOverrides: Record<string, Partial<Record<ManageablePermissionKey, boolean>>>;
  roleOverrides?: RolePermissionOverrides;
};

export async function loadTeamPermissionsPanelData(
  clinicId: string
): Promise<TeamPermissionsPanelData> {
  const supabase = await createClient();

  const [membersResult, overridesResult, roleOverrides] = await Promise.all([
    supabase
      .from("clinic_members")
      .select("id, role, uses_shared_ai, is_active, profiles(full_name, email)")
      .eq("clinic_id", clinicId)
      .eq("is_active", true),
    supabase
      .from("clinic_member_permissions")
      .select("member_id, permission_key, granted")
      .eq("clinic_id", clinicId),
    loadRoleOverrides(clinicId),
  ]);

  const { buildPermissionOverridesByMember } = await import(
    "@/core/permissions/member-permissions"
  );

  return {
    members: (membersResult.data ?? []) as unknown as TeamPermissionMember[],
    permissionOverrides: buildPermissionOverridesByMember(overridesResult.data ?? []),
    roleOverrides,
  };
}
