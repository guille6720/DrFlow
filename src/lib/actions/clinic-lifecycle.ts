"use server";

import { revalidatePath } from "next/cache";

import { setClinicEntitlementStatus } from "@/core/entitlements/admin.server";
import { requireSuperadminOrDeny } from "@/core/entitlements/superadmin-guard.server";
import { recordAudit } from "@/core/security/audit-service";
import { createAdminClient, hasAdminClient } from "@/core/supabase/admin";
import { createClient } from "@/core/supabase/server";
import { parseEntityId } from "@/core/validations/params";

type Result = { success: true; message: string } | { error: string };

async function banOrUnbanUsers(userIds: string[], mode: "ban" | "unban") {
  if (!hasAdminClient() || userIds.length === 0) return;
  const admin = createAdminClient();
  for (const userId of userIds) {
    await admin.auth.admin.updateUserById(userId, {
      ban_duration: mode === "ban" ? "876000h" : "none",
    });
    const authAdmin = admin.auth.admin as typeof admin.auth.admin & {
      signOut?: (id: string, scope?: "global" | "local" | "others") => Promise<{ error: Error | null }>;
    };
    if (mode === "ban" && typeof authAdmin.signOut === "function") {
      await authAdmin.signOut(userId, "global");
    }
  }
}

async function loadClinicMemberUserIds(clinicId: string): Promise<{ userIds: string[] } | { error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clinic_members")
    .select("user_id")
    .eq("clinic_id", clinicId);
  if (error) return { error: error.message };
  const userIds = (data ?? [])
    .map((m) => m.user_id)
    .filter((id): id is string => typeof id === "string" && id.length > 0);
  return { userIds };
}

function revalidateClinicPaths(clinicId: string) {
  revalidatePath("/superadmin");
  revalidatePath("/superadmin/clinics");
  revalidatePath(`/superadmin/clinics/${clinicId}`);
}

/** Suspende acceso a la clínica (independiente del rol de cada miembro). */
export async function superadminSuspendClinic(clinicId: string): Promise<Result> {
  const access = await requireSuperadminOrDeny();
  if (!access.ok) return { error: "Solo Superadmin." };

  const idParsed = parseEntityId(clinicId, "Clínica");
  if (!idParsed.ok) return { error: idParsed.error };

  const supabase = await createClient();
  const { data: clinic, error: clinicErr } = await supabase
    .from("clinics")
    .select("id, name, is_active")
    .eq("id", idParsed.data)
    .maybeSingle();
  if (clinicErr) return { error: clinicErr.message };
  if (!clinic) return { error: "Clínica no encontrada." };

  const membersResult = await loadClinicMemberUserIds(idParsed.data);
  if ("error" in membersResult) return { error: membersResult.error };

  const { error: updClinic } = await supabase
    .from("clinics")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", idParsed.data);
  if (updClinic) return { error: updClinic.message };

  const { error: updMembers } = await supabase
    .from("clinic_members")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("clinic_id", idParsed.data);
  if (updMembers) return { error: updMembers.message };

  await banOrUnbanUsers(membersResult.userIds, "ban");

  // Commercial pause (best-effort — clinic may have no live subscription).
  await setClinicEntitlementStatus({
    clinicId: idParsed.data,
    status: "cancelled",
    reason: "Superadmin suspendió la clínica desde el listado",
  });

  await recordAudit({
    clinicId: idParsed.data,
    module: "settings",
    entityType: "clinic",
    entityId: idParsed.data,
    action: "update",
    what: "suspend_clinic",
    metadata: { clinic_name: clinic.name, banned_users: membersResult.userIds.length },
  });

  revalidateClinicPaths(idParsed.data);
  return {
    success: true,
    message: `Clínica «${clinic.name}» suspendida. Los usuarios no pueden ingresar.`,
  };
}

/** Reactiva una clínica suspendida/eliminada lógicamente. */
export async function superadminReactivateClinic(clinicId: string): Promise<Result> {
  const access = await requireSuperadminOrDeny();
  if (!access.ok) return { error: "Solo Superadmin." };

  const idParsed = parseEntityId(clinicId, "Clínica");
  if (!idParsed.ok) return { error: idParsed.error };

  const supabase = await createClient();
  const { data: clinic, error: clinicErr } = await supabase
    .from("clinics")
    .select("id, name, slug")
    .eq("id", idParsed.data)
    .maybeSingle();
  if (clinicErr) return { error: clinicErr.message };
  if (!clinic) return { error: "Clínica no encontrada." };

  const membersResult = await loadClinicMemberUserIds(idParsed.data);
  if ("error" in membersResult) return { error: membersResult.error };

  const restoredName = clinic.name.replace(/^\[ELIMINADA\]\s*/i, "");
  const restoredSlug = clinic.slug.replace(/^deleted-[a-f0-9]+-/i, "");

  const { error: updClinic } = await supabase
    .from("clinics")
    .update({
      is_active: true,
      name: restoredName,
      slug: restoredSlug || clinic.slug,
      updated_at: new Date().toISOString(),
    })
    .eq("id", idParsed.data);
  if (updClinic) return { error: updClinic.message };

  const { error: updMembers } = await supabase
    .from("clinic_members")
    .update({ is_active: true, updated_at: new Date().toISOString() })
    .eq("clinic_id", idParsed.data);
  if (updMembers) return { error: updMembers.message };

  await banOrUnbanUsers(membersResult.userIds, "unban");

  await recordAudit({
    clinicId: idParsed.data,
    module: "settings",
    entityType: "clinic",
    entityId: idParsed.data,
    action: "update",
    what: "reactivate_clinic",
    metadata: { clinic_name: restoredName, unbanned_users: membersResult.userIds.length },
  });

  revalidateClinicPaths(idParsed.data);
  return {
    success: true,
    message: `Clínica «${restoredName}» reactivada. Revisá el plan comercial si hacía falta.`,
  };
}

/**
 * Baja lógica de la clínica: no borra pacientes ni HC.
 * Suspende acceso, marca la clínica como eliminada y libera el slug.
 */
export async function superadminSoftDeleteClinic(
  clinicId: string,
  confirmationName: string
): Promise<Result> {
  const access = await requireSuperadminOrDeny();
  if (!access.ok) return { error: "Solo Superadmin." };

  const idParsed = parseEntityId(clinicId, "Clínica");
  if (!idParsed.ok) return { error: idParsed.error };

  const supabase = await createClient();
  const { data: clinic, error: clinicErr } = await supabase
    .from("clinics")
    .select("id, name, slug, is_active")
    .eq("id", idParsed.data)
    .maybeSingle();
  if (clinicErr) return { error: clinicErr.message };
  if (!clinic) return { error: "Clínica no encontrada." };

  const expected = clinic.name.replace(/^\[ELIMINADA\]\s*/i, "").trim().toLowerCase();
  const provided = (confirmationName ?? "").trim().toLowerCase();
  if (!expected || provided !== expected) {
    return {
      error: `Confirmación inválida. Escribí el nombre exacto de la clínica: «${clinic.name.replace(/^\[ELIMINADA\]\s*/i, "")}»`,
    };
  }

  const membersResult = await loadClinicMemberUserIds(idParsed.data);
  if ("error" in membersResult) return { error: membersResult.error };

  const baseName = clinic.name.replace(/^\[ELIMINADA\]\s*/i, "");
  const newSlug = `deleted-${idParsed.data.slice(0, 8)}-${clinic.slug.replace(/^deleted-[a-f0-9]+-/i, "")}`.slice(
    0,
    80
  );

  const { error: updClinic } = await supabase
    .from("clinics")
    .update({
      is_active: false,
      name: `[ELIMINADA] ${baseName}`.slice(0, 200),
      slug: newSlug,
      updated_at: new Date().toISOString(),
    })
    .eq("id", idParsed.data);
  if (updClinic) return { error: updClinic.message };

  const { error: updMembers } = await supabase
    .from("clinic_members")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("clinic_id", idParsed.data);
  if (updMembers) return { error: updMembers.message };

  await banOrUnbanUsers(membersResult.userIds, "ban");

  await setClinicEntitlementStatus({
    clinicId: idParsed.data,
    status: "cancelled",
    reason: "Superadmin eliminó (baja lógica) la clínica desde el listado",
  });

  // Free Auth emails for users who no longer belong to any *active* clinic.
  const purgedEmails: string[] = [];
  for (const userId of membersResult.userIds) {
    const { data: otherMemberships, error: memErr } = await supabase
      .from("clinic_members")
      .select("clinic_id, clinics(is_active)")
      .eq("user_id", userId);
    if (memErr) continue;

    const anyActiveClinic = (otherMemberships ?? []).some((row) => {
      const clinic = row.clinics as { is_active?: boolean } | { is_active?: boolean }[] | null;
      const active = Array.isArray(clinic) ? clinic[0]?.is_active : clinic?.is_active;
      return active === true;
    });
    if (anyActiveClinic) continue;

    const { data: profile } = await supabase
      .from("profiles")
      .select("email, is_superadmin")
      .eq("id", userId)
      .maybeSingle();
    if (profile?.is_superadmin) continue;

    const { error: delErr } = await (supabase as unknown as {
      rpc: (
        fn: string,
        args: { p_clinic_id: string; p_user_id: string }
      ) => Promise<{ error: { message: string } | null }>;
    }).rpc("admin_permanently_delete_clinic_user", {
      p_clinic_id: idParsed.data,
      p_user_id: userId,
    });

    if (delErr) {
      if (!hasAdminClient()) continue;
      const admin = createAdminClient();
      const { error: authDelErr } = await admin.auth.admin.deleteUser(userId);
      if (authDelErr) {
        // Immutable legal rows may block Auth delete — free the original email instead.
        const { data: released, error: releaseErr } = await (admin as unknown as {
          rpc: (
            fn: string,
            args: { p_user_id: string }
          ) => Promise<{ data: string | null; error: { message: string } | null }>;
        }).rpc("release_auth_email_for_deleted_user", { p_user_id: userId });
        if (releaseErr || !released) continue;
        purgedEmails.push(released);
        continue;
      }
    }
    if (profile?.email) purgedEmails.push(profile.email);
  }

  await recordAudit({
    clinicId: idParsed.data,
    module: "settings",
    entityType: "clinic",
    entityId: idParsed.data,
    action: "delete",
    what: "soft_delete_clinic",
    metadata: {
      clinic_name: baseName,
      banned_users: membersResult.userIds.length,
      purged_auth_emails: purgedEmails,
      patients_preserved: true,
      clinical_records_preserved: true,
    },
  });

  revalidateClinicPaths(idParsed.data);
  const purgeNote =
    purgedEmails.length > 0
      ? ` Correos liberados en Auth: ${purgedEmails.join(", ")}.`
      : " Los correos que siguen en otras clínicas activas no se borraron de Auth.";
  return {
    success: true,
    message: `Clínica «${baseName}» eliminada (baja lógica). Pacientes e historias se conservan.${purgeNote}`,
  };
}
