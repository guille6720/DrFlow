"use server";

import { revalidatePath } from "next/cache";
import { getActiveClinic, getActiveClinicId, getSession, logAudit } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions/roles";
import { createAdminClient, hasAdminClient } from "@/lib/supabase/admin";

const BUCKET = "clinical-files";
const CONFIRM_PHRASE = "BORRAR HISTORIAS";
const STORAGE_REMOVE_BATCH = 100;

export type ClearClinicalHistoryResult =
  | {
      success: true;
      clinicalRecordsDeleted: number;
      attachmentsDeleted: number;
      storageObjectsRemoved: number;
      prescriptionDraftsDeleted: number;
    }
  | { success: false; error: string };

async function requireClinicalResetAccess() {
  const clinicId = await getActiveClinicId();
  const { role, isSuperadmin } = await getActiveClinic();
  if (!clinicId || !hasPermission(role, "manageClinic", isSuperadmin)) {
    return { error: "Solo un administrador de la clínica puede vaciar historias." as const, clinicId: null, userId: null };
  }
  const user = await getSession();
  if (!user) return { error: "Sesión requerida" as const, clinicId: null, userId: null };
  if (!hasAdminClient()) {
    return {
      error: "Falta SUPABASE_SERVICE_ROLE_KEY en el servidor (necesario para borrado masivo).",
      clinicId: null,
      userId: null,
    };
  }
  return { error: null, clinicId, userId: user.id };
}

export async function clearClinicClinicalHistory(
  confirmation: string
): Promise<ClearClinicalHistoryResult> {
  const access = await requireClinicalResetAccess();
  if (access.error || !access.clinicId || !access.userId) {
    return { success: false, error: access.error ?? "Sin permisos" };
  }

  if (confirmation.trim() !== CONFIRM_PHRASE) {
    return {
      success: false,
      error: `Escribí exactamente «${CONFIRM_PHRASE}» para confirmar.`,
    };
  }

  const clinicId = access.clinicId;
  const admin = createAdminClient();

  const { data: attachments, error: attListError } = await admin
    .from("patient_attachments")
    .select("id, file_path")
    .eq("clinic_id", clinicId);

  if (attListError) {
    return { success: false, error: attListError.message };
  }

  const paths = (attachments ?? []).map((a) => a.file_path).filter(Boolean);
  let storageObjectsRemoved = 0;

  for (let i = 0; i < paths.length; i += STORAGE_REMOVE_BATCH) {
    const batch = paths.slice(i, i + STORAGE_REMOVE_BATCH);
    const { error: storageError } = await admin.storage.from(BUCKET).remove(batch);
    if (storageError) {
      console.error("[clinical-reset] storage remove:", storageError.message);
    } else {
      storageObjectsRemoved += batch.length;
    }
  }

  const { count: recordsBefore } = await admin
    .from("clinical_records")
    .select("id", { count: "exact", head: true })
    .eq("clinic_id", clinicId);

  const attachmentCount = attachments?.length ?? 0;

  const { error: recordsError } = await admin
    .from("clinical_records")
    .delete()
    .eq("clinic_id", clinicId);

  if (recordsError) {
    return { success: false, error: `No se pudieron borrar consultas: ${recordsError.message}` };
  }

  const { error: attDeleteError } = await admin
    .from("patient_attachments")
    .delete()
    .eq("clinic_id", clinicId);

  if (attDeleteError) {
    return { success: false, error: attDeleteError.message };
  }

  const { count: rxCountBefore, error: rxCountError } = await admin
    .from("prescription_drafts")
    .select("id", { count: "exact", head: true })
    .eq("clinic_id", clinicId);

  if (rxCountError) {
    return { success: false, error: rxCountError.message };
  }

  const { error: rxError } = await admin
    .from("prescription_drafts")
    .delete()
    .eq("clinic_id", clinicId);

  if (rxError) {
    return { success: false, error: rxError.message };
  }

  await logAudit({
    clinicId,
    entityType: "clinical_record",
    entityId: clinicId,
    action: "delete",
    metadata: {
      type: "clinic_clinical_history_reset",
      clinicalRecordsDeleted: recordsBefore ?? 0,
      attachmentsDeleted: attachmentCount,
      prescriptionDraftsDeleted: rxCountBefore ?? 0,
    },
  });

  revalidatePath("/historias");
  revalidatePath("/datos");
  revalidatePath("/pacientes");

  return {
    success: true,
    clinicalRecordsDeleted: recordsBefore ?? 0,
    attachmentsDeleted: attachmentCount,
    storageObjectsRemoved,
    prescriptionDraftsDeleted: rxCountBefore ?? 0,
  };
}

export const CLEAR_CLINICAL_HISTORY_CONFIRM_PHRASE = CONFIRM_PHRASE;
