"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

import { resolveAccessFields } from "@/core/actions/action-response";
import { getActiveClinic, getActiveClinicId, getSession } from "@/core/auth/session.server";
import { logAudit } from "@/core/auth/session.actions";
import { logServerError } from "@/core/errors/log-error.server";
import { hasPermission } from "@/core/permissions/roles";
import { createAdminClient, hasAdminClient } from "@/core/supabase/admin";

import {
  CLEAR_CLINICAL_HISTORY_CONFIRM_PHRASE,
  CLEAR_FULL_MIGRATION_CONFIRM_PHRASE,
} from "@/lib/constants/migration-reset";

const BUCKET = "clinical-files";
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

export type ClearFullMigrationResult =
  | (ClearClinicalHistoryResult & {
      success: true;
      patientsDeleted: number;
      paymentsDeleted: number;
    })
  | { success: false; error: string };

async function requireClinicalResetAccess() {
  const clinicId = await getActiveClinicId();
  const { role, isSuperadmin } = await getActiveClinic();
  if (!clinicId || !hasPermission(role, "manageClinic", isSuperadmin)) {
    return {
      error: "Solo un administrador de la clínica puede vaciar datos de migración." as const,
      clinicId: null,
      userId: null,
    };
  }
  const user = await getSession();
  if (!user) return { error: "Sesión requerida" as const, clinicId: null, userId: null };
  if (!hasAdminClient()) {
    return {
      error: "El servidor no está configurado para borrado masivo de datos clínicos.",
      clinicId: null,
      userId: null,
    };
  }
  return { error: null, clinicId, userId: user.id };
}

async function executeClinicalHistoryClear(
  admin: SupabaseClient,
  clinicId: string
): Promise<
  | {
      clinicalRecordsDeleted: number;
      attachmentsDeleted: number;
      storageObjectsRemoved: number;
      prescriptionDraftsDeleted: number;
    }
  | { error: string }
> {
  const { data: attachments, error: attListError } = await admin
    .from("patient_attachments")
    .select("id, file_path")
    .eq("clinic_id", clinicId);

  if (attListError) return { error: attListError.message };

  const paths = (attachments ?? []).map((a) => a.file_path).filter(Boolean);
  let storageObjectsRemoved = 0;

  for (let i = 0; i < paths.length; i += STORAGE_REMOVE_BATCH) {
    const batch = paths.slice(i, i + STORAGE_REMOVE_BATCH);
    const { error: storageError } = await admin.storage.from(BUCKET).remove(batch);
    if (storageError) {
      logServerError("clinical-reset.storage-remove", storageError, { clinicId, metadata: { batchSize: batch.length } });
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
    return { error: `No se pudieron borrar consultas: ${recordsError.message}` };
  }

  const { error: attDeleteError } = await admin
    .from("patient_attachments")
    .delete()
    .eq("clinic_id", clinicId);

  if (attDeleteError) return { error: attDeleteError.message };

  const { count: rxCountBefore, error: rxCountError } = await admin
    .from("prescription_drafts")
    .select("id", { count: "exact", head: true })
    .eq("clinic_id", clinicId);

  if (rxCountError) return { error: rxCountError.message };

  const { error: rxError } = await admin
    .from("prescription_drafts")
    .delete()
    .eq("clinic_id", clinicId);

  if (rxError) return { error: rxError.message };

  return {
    clinicalRecordsDeleted: recordsBefore ?? 0,
    attachmentsDeleted: attachmentCount,
    storageObjectsRemoved,
    prescriptionDraftsDeleted: rxCountBefore ?? 0,
  };
}

function revalidateMigrationPaths() {
  revalidatePath("/historias");
  revalidatePath("/datos");
  revalidatePath("/pacientes");
  revalidatePath("/agenda");
}

export async function clearClinicClinicalHistory(
  confirmation: string
): Promise<ClearClinicalHistoryResult> {
  const access = await requireClinicalResetAccess();
  const auth = resolveAccessFields(access);
  if (!auth.ok) return { success: false, error: auth.error };

  if (confirmation.trim() !== CLEAR_CLINICAL_HISTORY_CONFIRM_PHRASE) {
    return {
      success: false,
      error: `Escribí exactamente «${CLEAR_CLINICAL_HISTORY_CONFIRM_PHRASE}» para confirmar.`,
    };
  }

  const admin = createAdminClient();
  const cleared = await executeClinicalHistoryClear(admin, auth.clinicId);
  if ("error" in cleared) return { success: false, error: cleared.error };

  await logAudit({
    clinicId: auth.clinicId,
    entityType: "clinical_record",
    entityId: auth.clinicId,
    action: "delete",
    metadata: { type: "clinic_clinical_history_reset", ...cleared },
  });

  revalidateMigrationPaths();

  return { success: true, ...cleared };
}

export async function clearClinicFullMigrationReset(
  confirmation: string
): Promise<ClearFullMigrationResult> {
  const access = await requireClinicalResetAccess();
  const auth = resolveAccessFields(access);
  if (!auth.ok) return { success: false, error: auth.error };

  if (confirmation.trim() !== CLEAR_FULL_MIGRATION_CONFIRM_PHRASE) {
    return {
      success: false,
      error: `Escribí exactamente «${CLEAR_FULL_MIGRATION_CONFIRM_PHRASE}» para confirmar.`,
    };
  }

  const clinicId = auth.clinicId;
  const admin = createAdminClient();

  const cleared = await executeClinicalHistoryClear(admin, clinicId);
  if ("error" in cleared) return { success: false, error: cleared.error };

  const { count: paymentsBefore, error: payCountError } = await admin
    .from("payments")
    .select("id", { count: "exact", head: true })
    .eq("clinic_id", clinicId);

  if (payCountError) return { success: false, error: payCountError.message };

  const { error: payDeleteError } = await admin.from("payments").delete().eq("clinic_id", clinicId);

  if (payDeleteError) {
    return { success: false, error: `No se pudieron borrar pagos: ${payDeleteError.message}` };
  }

  const { count: patientsBefore, error: patientCountError } = await admin
    .from("patients")
    .select("id", { count: "exact", head: true })
    .eq("clinic_id", clinicId);

  if (patientCountError) return { success: false, error: patientCountError.message };

  const { error: patientsError } = await admin.from("patients").delete().eq("clinic_id", clinicId);

  if (patientsError) {
    return { success: false, error: `No se pudieron borrar pacientes: ${patientsError.message}` };
  }

  await logAudit({
    clinicId,
    entityType: "patient",
    entityId: clinicId,
    action: "delete",
    metadata: {
      type: "clinic_full_migration_reset",
      ...cleared,
      patientsDeleted: patientsBefore ?? 0,
      paymentsDeleted: paymentsBefore ?? 0,
    },
  });

  revalidateMigrationPaths();

  return {
    success: true,
    ...cleared,
    patientsDeleted: patientsBefore ?? 0,
    paymentsDeleted: paymentsBefore ?? 0,
  };
}
