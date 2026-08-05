"use server";

import { createClient } from "@/core/supabase/server";
import { validateCsvImportUpload } from "@/core/security/file-upload";
import { recordAudit } from "@/core/security/audit-service";
import { requireClinicalImportAccess } from "@/core/services/import-access.service";
import { HCE_EXPORT_MAX_BYTES } from "@/lib/constants/clinical-documents";
import {
  processHceImportBatchFromContent,
  type ImportHceExportResult,
} from "@/features/integraciones/server/hce-import-batch";

export type { ImportHceExportResult };

export async function importHceExportCsv(formData: FormData): Promise<ImportHceExportResult> {
  try {
    return await importHceExportCsvInner(formData);
  } catch (err) {
    console.error("[hce-import] failed:", err);
    const f = formData.get("file");
    return {
      success: false,
      fileName: f instanceof File ? f.name : "HCE_export.csv",
      error: "La importación HCE se interrumpió. Reintentá; el progreso parcial puede estar en Pacientes.",
    };
  }
}

async function importHceExportCsvInner(formData: FormData): Promise<ImportHceExportResult> {
  const access = await requireClinicalImportAccess();
  if (access.error || !access.clinicId || !access.userId) {
    return { success: false, fileName: "", error: access.error ?? "Sin permisos" };
  }

  const file = formData.get("file");
  const originalName = file instanceof File ? file.name : "HCE_export.csv";

  if (!(file instanceof File)) {
    return {
      success: false,
      fileName: originalName,
      error: "CSV HCE inválido o mayor a 15 MB.",
    };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const validated = validateCsvImportUpload(file, buffer, HCE_EXPORT_MAX_BYTES);
  if (!validated.ok) {
    return { success: false, fileName: originalName, error: validated.error };
  }

  const content = buffer.toString("utf-8");
  const offset = Math.max(0, Number(formData.get("offset") ?? 0) || 0);

  const supabase = await createClient();
  const result = await processHceImportBatchFromContent(supabase, {
    clinicId: access.clinicId,
    userId: access.userId,
    content,
    originalName,
    offset,
  });

  if (result.success) {
    await recordAudit({
      clinicId: access.clinicId,
      module: "imports",
      entityType: "clinical_record",
      entityId: access.clinicId,
      action: "create",
      what: "Importó lote HCE CSV",
      metadata: {
        fileName: originalName,
        recordsCreated: result.recordsCreated,
        patientsCreated: result.patientsCreated,
        offset,
      },
    });
  }

  return result;
}
