"use server";

import { resolveImportAccess } from "@/core/actions/action-response";
import { recordAudit } from "@/core/security/audit-service";
import { verifyPatientInClinic } from "@/core/security/ownership-guard";
import { requireClinicalExportAccess } from "@/core/services/import-access.service";
import { mapClinicalSnapshotToFhirBundle } from "@/core/services/interoperability/fhir";
import { createClient } from "@/core/supabase/server";
import { parseEntityId } from "@/core/validations/params";

import {
  buildClinicalExportDocument,
  countExportedRecords,
} from "@/features/integraciones/lib/clinical-export-package";
import {
  parseClinicalExportSections,
  parseExportDateRange,
} from "@/features/integraciones/lib/clinical-export-sections";
import { buildClinicalExportPdf } from "@/features/integraciones/server/build-clinical-export-pdf";
import { loadPatientExportPackage } from "@/features/integraciones/server/load-patient-export-package";
import { packClinicalExportZip } from "@/features/integraciones/server/pack-clinical-export-zip";

import { uploadExportStagingFile } from "@/lib/server/export-staging";
import {
  buildClinicalHistoryFilename,
  buildClinicalPackageJsonFilename,
  buildClinicalPackageZipFilename,
} from "@/lib/utils/clinical-history-filename";

export type ClinicalExportFormat = "json" | "pdf" | "zip" | "fhir";

export type ClinicalExportInput = {
  patientId: string;
  format: ClinicalExportFormat;
  sections?: unknown;
  dateFrom?: string | null;
  dateTo?: string | null;
};

export type ClinicalExportResult = {
  error?: string;
  fileName?: string;
  mime?: string;
  base64?: string;
  url?: string;
};

export async function exportPatientClinicalPackage(
  input: ClinicalExportInput
): Promise<ClinicalExportResult> {
  const access = await requireClinicalExportAccess();
  const auth = resolveImportAccess(access);
  if (!auth.ok) return { error: auth.error };

  const parsed = parseEntityId(input.patientId, "Paciente");
  if (!parsed.ok) return { error: parsed.error };
  if (input.format !== "json" && input.format !== "pdf" && input.format !== "zip" && input.format !== "fhir") {
    return { error: "Formato de exportación inválido." };
  }

  const sections = parseClinicalExportSections(input.sections);
  const rangeParsed = parseExportDateRange(input.dateFrom, input.dateTo);
  if (!rangeParsed.ok) return { error: rangeParsed.error };

  const supabase = await createClient();
  const owned = await verifyPatientInClinic(supabase, auth.clinicId, parsed.data);
  if (!owned.ok) return { error: owned.error };

  const packed = await loadPatientExportPackage(
    supabase,
    auth.clinicId,
    parsed.data,
    sections,
    rangeParsed.range
  );
  const document = buildClinicalExportDocument(packed.snapshot, sections);
  const recordCount = countExportedRecords(document);
  const names = packed.snapshot.patient;

  await recordAudit({
    clinicId: auth.clinicId,
    module: "imports",
    entityType: "data_export",
    entityId: parsed.data,
    patientId: parsed.data,
    action: "export",
    what: "Exportó historia clínica",
    metadata: {
      format: input.format,
      sections,
      recordCount,
      dateRange: rangeParsed.range,
      documentNumber: names.document_number,
    },
  });

  if (input.format === "json") {
    const json = JSON.stringify(document, null, 2);
    return {
      fileName: buildClinicalPackageJsonFilename(names),
      mime: "application/json;charset=utf-8",
      base64: Buffer.from(json, "utf8").toString("base64"),
    };
  }

  if (input.format === "fhir") {
    const bundle = mapClinicalSnapshotToFhirBundle(packed.snapshot, sections);
    const json = JSON.stringify(bundle, null, 2);
    return {
      fileName: `${buildClinicalPackageJsonFilename(names).replace(/\.json$/i, "")}.fhir.json`,
      mime: "application/fhir+json;charset=utf-8",
      base64: Buffer.from(json, "utf8").toString("base64"),
    };
  }

  if (input.format === "pdf") {
    const pdf = await buildClinicalExportPdf(packed.snapshot);
    return {
      fileName: buildClinicalHistoryFilename(names),
      mime: "application/pdf",
      base64: pdf.toString("base64"),
    };
  }

  const { zip } = await packClinicalExportZip(
    supabase,
    auth.clinicId,
    packed.snapshot,
    packed.files,
    sections,
    rangeParsed.range
  );
  const fileName = buildClinicalPackageZipFilename(names);
  const uploaded = await uploadExportStagingFile(
    supabase,
    auth.clinicId,
    fileName,
    zip,
    "application/zip"
  );
  return { fileName, mime: "application/zip", url: uploaded.signedUrl };
}
