"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

import { resolveAccessFields } from "@/core/actions/action-response";
import { logAudit } from "@/core/auth/session.actions";
import { getActiveClinic, getActiveClinicId, getSession } from "@/core/auth/session.server";
import {
  isClinicalHistoryResetEnabled,
  parsePurgeClinicClinicalDataResult,
} from "@/core/compliance/clinical-deletion-protection";
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
  if (!isClinicalHistoryResetEnabled()) {
    return {
      error:
        "El vaciado masivo de historia clínica está deshabilitado en este entorno. Configure ALLOW_CLINICAL_HISTORY_RESET=true solo en staging/migración.",
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
      logServerError("clinical-reset.storage-remove", storageError, {
        clinicId,
        metadata: { batchSize: batch.length },
      });
    } else {
      storageObjectsRemoved += batch.length;
    }
  }

  // Phase 7: hard delete via SECURITY DEFINER purge RPC (sets transaction GUC).
  // Direct DELETE on clinical_records is blocked by triggers.
  const { data, error: purgeError } = await admin.rpc(
    "purge_clinic_clinical_data_for_migration" as never,
    {
      p_clinic_id: clinicId,
      p_confirm_phrase: CLEAR_CLINICAL_HISTORY_CONFIRM_PHRASE,
    } as never
  );

  if (purgeError) {
    return {
      error: `No se pudo vaciar la historia clínica (protección anti-borrado): ${purgeError.message}`,
    };
  }

  const parsed = parsePurgeClinicClinicalDataResult(data);
  if (!parsed) {
    return { error: "Respuesta inválida del purge de migración." };
  }

  return {
    clinicalRecordsDeleted: parsed.clinical_records_deleted,
    attachmentsDeleted: parsed.attachments_deleted,
    storageObjectsRemoved,
    prescriptionDraftsDeleted: parsed.prescription_drafts_deleted,
  };
}

function revalidateMigrationPaths() {
  revalidatePath("/datos");
  revalidatePath("/pacientes");
  revalidatePath("/turnos/agenda");
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
    metadata: {
      type: "clinic_clinical_history_reset",
      via: "purge_clinic_clinical_data_for_migration",
      ...cleared,
    },
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
      via: "purge_clinic_clinical_data_for_migration",
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
