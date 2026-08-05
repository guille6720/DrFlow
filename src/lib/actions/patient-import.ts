"use server";

import { createClient } from "@/core/supabase/server";
import { validateSpreadsheetImportUpload } from "@/core/security/file-upload";
import { recordAudit } from "@/core/security/audit-service";
import { requirePatientImportAccess } from "@/core/services/import-access.service";
import { CONSUMERS_IMPORT_MAX_BYTES } from "@/lib/constants/clinical-documents";
import {
  processConsumersImportBatchFromBuffer,
  type ImportConsumersResult,
  IMPORT_BATCH_SIZE,
} from "@/features/pacientes/server/consumers-import-batch";

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

  if (!(file instanceof File)) {
    return {
      success: false,
      fileName: originalName,
      error: "Archivo inválido. Aceptamos .xlsx, .csv o .csv.xlsx de pacientes (máx. 15 MB).",
    };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const validated = validateSpreadsheetImportUpload(file, buffer, CONSUMERS_IMPORT_MAX_BYTES);
  if (!validated.ok) {
    return { success: false, fileName: originalName, error: validated.error };
  }

  const offset = Math.max(0, Number(formData.get("offset") ?? 0) || 0);
  const limit = Math.min(
    IMPORT_BATCH_SIZE,
    Math.max(1, Number(formData.get("limit") ?? IMPORT_BATCH_SIZE) || IMPORT_BATCH_SIZE)
  );

  const supabase = await createClient();
  const result = await processConsumersImportBatchFromBuffer(supabase, {
    clinicId: access.clinicId,
    userId: access.userId,
    buffer,
    originalName,
    offset,
    limit,
  });

  if (result.success) {
    await recordAudit({
      clinicId: access.clinicId,
      module: "imports",
      entityType: "patient",
      entityId: access.clinicId,
      action: "create",
      what: "Importó lote de pacientes",
      metadata: {
        fileName: originalName,
        patientsCreated: result.patientsCreated,
        patientsUpdated: result.patientsUpdated,
        offset,
      },
    });
  }

  return result;
}
