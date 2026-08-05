import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient, hasAdminClient } from "@/core/supabase/admin";

const CLINICAL_BUCKET = "clinical-files";
const STORAGE_REMOVE_BATCH = 100;

async function removeStoragePaths(admin: SupabaseClient, paths: string[]) {
  for (let i = 0; i < paths.length; i += STORAGE_REMOVE_BATCH) {
    const batch = paths.slice(i, i + STORAGE_REMOVE_BATCH);
    if (batch.length === 0) continue;
    await admin.storage.from(CLINICAL_BUCKET).remove(batch);
  }
}

/** Internal — purge clinics where user is sole active member. Caller must verify identity. */
export async function purgeSoleOwnerClinicsForUserInternal(
  userId: string
): Promise<{ error?: string }> {
  if (!hasAdminClient()) {
    return { error: "El servidor no está configurado para borrar el consultorio por completo." };
  }

  const admin = createAdminClient();

  const { data: memberships, error: memberError } = await admin
    .from("clinic_members")
    .select("clinic_id")
    .eq("user_id", userId);

  if (memberError) return { error: memberError.message };

  const clinicIds = [...new Set((memberships ?? []).map((m) => m.clinic_id))];

  for (const clinicId of clinicIds) {
    const { count: otherActive, error: countError } = await admin
      .from("clinic_members")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinicId)
      .eq("is_active", true)
      .neq("user_id", userId);

    if (countError) return { error: countError.message };
    if ((otherActive ?? 0) > 0) continue;

    const { data: attachments } = await admin
      .from("patient_attachments")
      .select("file_path")
      .eq("clinic_id", clinicId);

    const paths = (attachments ?? []).map((a) => a.file_path).filter(Boolean);
    if (paths.length > 0) {
      await removeStoragePaths(admin, paths);
    }

    await admin.from("clinic_invitations").delete().eq("clinic_id", clinicId);
    await admin.from("public_booking_links").delete().eq("clinic_id", clinicId);

    const { error: deleteError } = await admin.from("clinics").delete().eq("id", clinicId);
    if (deleteError) return { error: deleteError.message };
  }

  return {};
}
