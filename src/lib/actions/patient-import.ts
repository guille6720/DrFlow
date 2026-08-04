"use server";

import { createClient } from "@/core/supabase/server";
import { getActiveClinic, getActiveClinicId, getSession } from "@/core/auth/session";
import { hasPermission } from "@/core/permissions/roles";
import { CONSUMERS_IMPORT_MAX_BYTES } from "@/lib/constants/clinical-documents";import {
  processConsumersImportBatchFromBuffer,
  type ImportConsumersResult,
  IMPORT_BATCH_SIZE,
} from "@/features/pacientes/server/consumers-import-batch";

async function requirePatientImportAccess() {
  const clinicId = await getActiveClinicId();
  const { role, isSuperadmin } = await getActiveClinic();
  if (!clinicId || !hasPermission(role, "managePatients", isSuperadmin)) {
    return { error: "Sin permisos" as const, clinicId: null, userId: null };
  }
  const user = await getSession();
  if (!user) return { error: "Sesión requerida" as const, clinicId: null, userId: null };
  return { error: null, clinicId, userId: user.id };
}

function validateConsumersImportFile(file: unknown, fileName: string): file is File {
  if (!(file instanceof File) || file.size === 0) return false;
  const lower = fileName.toLowerCase();
  const okExt =
    lower.endsWith(".xlsx") ||
    lower.endsWith(".xls") ||
    lower.endsWith(".csv") ||
    lower.endsWith(".csv.xlsx");
  return okExt && file.size <= CONSUMERS_IMPORT_MAX_BYTES;
}

export type { ImportConsumersResult };

export async function importConsumersFile(
  formData: FormData
): Promise<ImportConsumersResult> {
  try {
    return await importConsumersFileInner(formData);
  } catch (err) {
    console.error("[patient-import] consumers failed:", err);
    const f = formData.get("file");
    const fileName = f instanceof File ? f.name : "archivo";
    return {
      success: false,
      fileName,
      error:
        "La importación se interrumpió (tiempo de servidor o error interno). Probá de nuevo; si persiste, contactá soporte.",
    };
  }
}

async function importConsumersFileInner(
  formData: FormData
): Promise<ImportConsumersResult> {
  const access = await requirePatientImportAccess();
  if (access.error || !access.clinicId || !access.userId) {
    return { success: false, fileName: "", error: access.error ?? "Sin permisos" };
  }

  const file = formData.get("file");
  const originalName = file instanceof File ? file.name : "consumers.xlsx";

  if (!validateConsumersImportFile(file, originalName)) {
    return {
      success: false,
      fileName: originalName,
      error: "Archivo inválido. Aceptamos .xlsx, .csv o .csv.xlsx de pacientes (máx. 15 MB).",
    };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const offset = Math.max(0, Number(formData.get("offset") ?? 0) || 0);
  const limit = Math.min(
    IMPORT_BATCH_SIZE,
    Math.max(1, Number(formData.get("limit") ?? IMPORT_BATCH_SIZE) || IMPORT_BATCH_SIZE)
  );

  const supabase = await createClient();
  return processConsumersImportBatchFromBuffer(supabase, {
    clinicId: access.clinicId,
    userId: access.userId,
    buffer,
    originalName,
    offset,
    limit,
  });
}
