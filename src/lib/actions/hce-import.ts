"use server";

import { resolveImportAccess } from "@/core/actions/action-response";
import { withActionErrorBoundary } from "@/core/errors/action-boundary.server";
import { recordAudit } from "@/core/security/audit-service";
import { validateCsvImportUpload } from "@/core/security/file-upload";
import { requireClinicalImportAccess } from "@/core/services/import-access.service";
import { createClient } from "@/core/supabase/server";

import {
  type ImportHceExportResult,
  processHceImportBatchFromContent,
} from "@/features/integraciones/server/hce-import-batch";

import { HCE_EXPORT_MAX_BYTES } from "@/lib/constants/clinical-documents";

export async function importHceExportCsv(formData: FormData): Promise<ImportHceExportResult> {
  return withActionErrorBoundary(
    "hce-import",
    (fileName) => ({
      success: false,
      fileName: fileName || "HCE_export.csv",
      error: "La importación HCE se interrumpió. Reintentá; el progreso parcial puede estar en Pacientes.",
    }),
    () => importHceExportCsvInner(formData),
    {
      getFileName: () => {
        const f = formData.get("file");
        return f instanceof File ? f.name : "HCE_export.csv";
      },
    }
  );
}

async function importHceExportCsvInner(formData: FormData): Promise<ImportHceExportResult> {
  const access = await requireClinicalImportAccess();
  const auth = resolveImportAccess(access);
  if (!auth.ok) return { success: false, fileName: "", error: auth.error };

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
    clinicId: auth.clinicId,
    userId: auth.userId,
    content,
    originalName,
    offset,
  });

  if (result.success) {
    await recordAudit({
      clinicId: auth.clinicId,
      module: "imports",
      entityType: "clinical_record",
      entityId: auth.clinicId,
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
