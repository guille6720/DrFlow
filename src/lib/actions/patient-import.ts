"use server";

import { resolveImportAccess } from "@/core/actions/action-response";
import { withActionErrorBoundary } from "@/core/errors/action-boundary.server";
import { recordAudit } from "@/core/security/audit-service";
import { validateSpreadsheetImportUpload } from "@/core/security/file-upload";
import { requirePatientImportAccess } from "@/core/services/import-access.service";
import { createClient } from "@/core/supabase/server";

import {
  IMPORT_BATCH_SIZE,
  type ImportConsumersResult,
  processConsumersImportBatchFromBuffer,
} from "@/features/pacientes/server/consumers-import-batch";

import { CONSUMERS_IMPORT_MAX_BYTES } from "@/lib/constants/clinical-documents";

export async function importConsumersFile(
  formData: FormData
): Promise<ImportConsumersResult> {
  return withActionErrorBoundary(
    "patient-import.consumers",
    (fileName) => ({
      success: false,
      fileName,
      error:
        "La importación se interrumpió (tiempo de servidor o error interno). Probá de nuevo; si persiste, contactá soporte.",
    }),
    () => importConsumersFileInner(formData),
    {
      getFileName: () => {
        const f = formData.get("file");
        return f instanceof File ? f.name : "archivo";
      },
    }
  );
}

async function importConsumersFileInner(
  formData: FormData
): Promise<ImportConsumersResult> {
  const access = await requirePatientImportAccess();
  const auth = resolveImportAccess(access);
  if (!auth.ok) return { success: false, fileName: "", error: auth.error };

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
    clinicId: auth.clinicId,
    userId: auth.userId,
    buffer,
    originalName,
    offset,
    limit,
  });

  if (result.success) {
    await recordAudit({
      clinicId: auth.clinicId,
      module: "imports",
      entityType: "patient",
      entityId: auth.clinicId,
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
