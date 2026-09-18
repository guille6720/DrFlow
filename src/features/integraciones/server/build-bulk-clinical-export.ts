import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  mapClinicalSnapshotToFhirBundle,
  mergeFhirPatientBundles,
} from "@/core/services/interoperability/fhir";

import { mapWithConcurrency } from "@/features/integraciones/lib/async-pool";
import {
  type BulkClinicalExportRequest,
  bulkExportNeedsClinicalLoad,
  bulkExportPatientCap,
  countBulkExportedRecords,
  flattenBulkExportSheets,
  isDemographicsOnly,
} from "@/features/integraciones/lib/bulk-clinical-export";
import {
  buildClinicalExportDocument,
  type ClinicalExportSnapshot,
} from "@/features/integraciones/lib/clinical-export-package";
import { toCsvDocument } from "@/features/integraciones/lib/spreadsheet-export-safety";
import { buildZipStore, type ZipStoreEntry } from "@/features/integraciones/lib/zip-store";
import { loadPatientExportPackage } from "@/features/integraciones/server/load-patient-export-package";
import { buildClinicalPackageZipEntries } from "@/features/integraciones/server/pack-clinical-export-zip";
import {
  type BulkExportPatientRow,
  selectBulkExportPatients,
} from "@/features/integraciones/server/select-bulk-export-patients";

import { BULK_EXPORT_ZIP_MAX_BYTES } from "@/lib/constants/clinical-documents";
import { getCachedClinicProfessionalsList } from "@/lib/server/cached-clinic-queries";
import { buildClinicalPackageBaseName } from "@/lib/utils/clinical-history-filename";
import { getProfessionalDisplayName } from "@/lib/utils/professional";

/** Parallel patient export cap — limits Supabase round-trip latency without overloading staging. */
const BULK_EXPORT_CONCURRENCY = 4;

export type BulkClinicalExportFile = {
  buffer: Buffer;
  fileName: string;
  mime: string;
  patientCount: number;
  recordCount: number;
  warnings: string[];
  truncated: boolean;
};

function rowToSnapshot(row: BulkExportPatientRow): ClinicalExportSnapshot {
  return {
    exported_at: new Date().toISOString(),
    patient: {
      last_name: row.last_name,
      first_name: row.first_name,
      document_number: row.document_number,
      birth_date: row.birth_date,
      phone: row.phone,
      email: row.email,
      address: row.address,
      insurance_provider: row.insurance_provider,
      insurance_plan: row.insurance_plan,
      insurance_number: row.insurance_number,
      emergency_contact_name: null,
      emergency_contact_phone: null,
    },
    medical_history: null,
    allergies: null,
    regular_medication: null,
    consultations: [],
    diagnoses: [],
    medications: [],
    prescriptions: [],
    orders: [],
    attachments: [],
    warnings: [],
  };
}

async function sheetsToXlsx(sheets: Record<string, string[][]>): Promise<Buffer> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) {
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), name.slice(0, 31));
  }
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

export async function buildBulkClinicalExport(
  supabase: SupabaseClient,
  clinicId: string,
  request: BulkClinicalExportRequest
): Promise<BulkClinicalExportFile> {
  const cap = bulkExportPatientCap(request.format, request.sections);
  const selected = await selectBulkExportPatients(supabase, clinicId, {
    scope: request.scope,
    patientIds: request.patientIds,
    professionalId: request.professionalId,
    insuranceProvider: request.insuranceProvider,
    range: request.range,
    limit: cap,
  });
  const warnings = selected.truncated
    ? [`Se exportaron los primeros ${cap} pacientes (tope del formato).`]
    : [];
  if (selected.patients.length === 0) {
    throw new Error("No hay pacientes para exportar con esos filtros.");
  }

  const loadClinical = bulkExportNeedsClinicalLoad(request.format, request.sections);
  const snapshots: ClinicalExportSnapshot[] = [];
  const packages: Array<{ snapshot: ClinicalExportSnapshot; files: Awaited<ReturnType<typeof loadPatientExportPackage>>["files"] }> =
    [];

  if (loadClinical) {
    const professionals = await getCachedClinicProfessionalsList(clinicId);
    const exportContext = {
      professionalName: new Map(
        professionals.map((row) => [row.id, getProfessionalDisplayName(row)])
      ),
    };
    const packedList = await mapWithConcurrency(
      selected.patients,
      BULK_EXPORT_CONCURRENCY,
      (row) =>
        loadPatientExportPackage(
          supabase,
          clinicId,
          row.id,
          request.sections,
          request.range,
          exportContext
        )
    );
    for (const packed of packedList) {
      snapshots.push(packed.snapshot);
      packages.push(packed);
      warnings.push(...packed.snapshot.warnings);
    }
  } else {
    snapshots.push(...selected.patients.map(rowToSnapshot));
  }

  const recordCount = countBulkExportedRecords(snapshots, request.sections);
  const stamp = new Date().toISOString().slice(0, 10);
  const base = `exportacion-masiva-${stamp}`;

  if (request.format === "csv" || request.format === "xlsx") {
    const sheets = flattenBulkExportSheets(snapshots, request.sections);
    if (request.format === "xlsx") {
      return {
        buffer: await sheetsToXlsx(sheets),
        fileName: `${base}.xlsx`,
        mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        patientCount: snapshots.length,
        recordCount,
        warnings,
        truncated: selected.truncated,
      };
    }
    const names = Object.keys(sheets);
    if (names.length === 1) {
      return {
        buffer: Buffer.from(toCsvDocument(sheets[names[0]]), "utf8"),
        fileName: `${base}.csv`,
        mime: "text/csv;charset=utf-8",
        patientCount: snapshots.length,
        recordCount,
        warnings,
        truncated: selected.truncated,
      };
    }
    const entries = Object.entries(sheets).map(([name, rows]) => ({
      name: `${name}.csv`,
      data: Buffer.from(toCsvDocument(rows), "utf8"),
    }));
    return {
      buffer: buildZipStore(entries),
      fileName: `${base}-csv.zip`,
      mime: "application/zip",
      patientCount: snapshots.length,
      recordCount,
      warnings,
      truncated: selected.truncated,
    };
  }

  if (request.format === "json") {
    const body = {
      schema: "drflow.bulk-clinical.v1",
      exported_at: new Date().toISOString(),
      sections: request.sections,
      date_range: request.range.from || request.range.to ? request.range : "all",
      warnings,
      patients: snapshots.map((snapshot) => buildClinicalExportDocument(snapshot, request.sections)),
    };
    return {
      buffer: Buffer.from(JSON.stringify(body, null, 2), "utf8"),
      fileName: `${base}.json`,
      mime: "application/json",
      patientCount: snapshots.length,
      recordCount,
      warnings,
      truncated: selected.truncated,
    };
  }

  if (request.format === "fhir") {
    const bundle = mergeFhirPatientBundles(
      snapshots.map((snapshot) => mapClinicalSnapshotToFhirBundle(snapshot, request.sections))
    );
    return {
      buffer: Buffer.from(JSON.stringify(bundle, null, 2), "utf8"),
      fileName: `${base}.fhir.json`,
      mime: "application/fhir+json",
      patientCount: snapshots.length,
      recordCount: bundle.total ?? snapshots.length,
      warnings,
      truncated: selected.truncated,
    };
  }

  const skipBinaries = isDemographicsOnly(request.sections);
  const entries: ZipStoreEntry[] = [];
  let remaining = BULK_EXPORT_ZIP_MAX_BYTES;
  for (const packed of packages) {
    const folder = buildClinicalPackageBaseName(packed.snapshot.patient) || "paciente";
    const built = await buildClinicalPackageZipEntries(
      supabase,
      clinicId,
      packed.snapshot,
      packed.files,
      request.sections,
      request.range,
      { skipBinaries, remainingBytes: remaining }
    );
    warnings.push(...built.warnings);
    remaining -= built.packedBytes;
    for (const entry of built.entries) {
      entries.push({ name: `Patients/${folder}/${entry.name}`, data: entry.data });
    }
    if (remaining <= 0) {
      warnings.push("Se omitieron adjuntos extra (máx. 80 MB en el ZIP masivo).");
      break;
    }
  }
  entries.push({
    name: "manifest.json",
    data: Buffer.from(
      JSON.stringify(
        {
          schema: "drflow.bulk-clinical-package.v1",
          generated_at: new Date().toISOString(),
          patient_count: snapshots.length,
          sections: request.sections,
          date_range: request.range.from || request.range.to ? request.range : "all",
          fhir: "r4",
          warnings,
        },
        null,
        2
      ),
      "utf8"
    ),
  });

  return {
    buffer: buildZipStore(entries),
    fileName: `${base}.zip`,
    mime: "application/zip",
    patientCount: snapshots.length,
    recordCount,
    warnings,
    truncated: selected.truncated,
  };
}
