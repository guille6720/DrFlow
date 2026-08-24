"use server";

import { revalidatePath } from "next/cache";

import { requireStaffManagerWithUser } from "@/core/actions/guard-adapters";
import { requireAddonFeatureAccess } from "@/core/entitlements/entitlements.server";
import { FEATURES } from "@/core/entitlements/features";
import {
  computeOverrideOnToggle,
  isManageablePermissionKey,
  type ManageablePermissionKey,
} from "@/core/permissions/member-permissions";
import { recordAudit } from "@/core/security/audit-service";
import { createClient } from "@/core/supabase/server";
import { parseEntityId } from "@/core/validations/params";

import type { UserRole } from "@/types/database";

async function requireTeamAdmin() {
  return requireStaffManagerWithUser();
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

  const overrideValue = computeOverrideOnToggle(
    member.role as UserRole,
    permissionKeyRaw,
    granted
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
};

export async function loadTeamPermissionsPanelData(
  clinicId: string
): Promise<TeamPermissionsPanelData> {
  const supabase = await createClient();

  const [membersResult, overridesResult] = await Promise.all([
    supabase
      .from("clinic_members")
      .select("id, role, uses_shared_ai, is_active, profiles(full_name, email)")
      .eq("clinic_id", clinicId)
      .eq("is_active", true),
    supabase
      .from("clinic_member_permissions")
      .select("member_id, permission_key, granted")
      .eq("clinic_id", clinicId),
  ]);

  const { buildPermissionOverridesByMember } = await import(
    "@/core/permissions/member-permissions"
  );

  return {
    members: (membersResult.data ?? []) as unknown as TeamPermissionMember[],
    permissionOverrides: buildPermissionOverridesByMember(overridesResult.data ?? []),
  };
}
