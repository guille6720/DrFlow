import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { sanitizeStorageFileName } from "@/core/security/file-upload";
import { assertStoragePathInClinic } from "@/core/security/tenant-scope";
import { mapClinicalSnapshotToFhirBundle, splitBundleByType } from "@/core/services/interoperability/fhir";

import {
  buildClinicalExportDocument,
  type ClinicalExportSnapshot,
} from "@/features/integraciones/lib/clinical-export-package";
import type { ClinicalExportDateRange, ClinicalExportSection } from "@/features/integraciones/lib/clinical-export-sections";
import { buildZipStore, type ZipStoreEntry } from "@/features/integraciones/lib/zip-store";
import { buildClinicalExportPdf } from "@/features/integraciones/server/build-clinical-export-pdf";
import type { ExportAttachmentFile } from "@/features/integraciones/server/load-patient-export-package";

const BUCKET = "clinical-files";
const ZIP_MAX_FILES = 50;
const ZIP_MAX_BYTES = 50 * 1024 * 1024;

function uniqueEntryName(used: Set<string>, folder: string, fileName: string): string {
  const safe = sanitizeStorageFileName(fileName, "documento");
  let name = `${folder}/${safe}`;
  let index = 2;
  while (used.has(name.toLowerCase())) {
    const dot = safe.lastIndexOf(".");
    const base = dot > 0 ? safe.slice(0, dot) : safe;
    const ext = dot > 0 ? safe.slice(dot) : "";
    name = `${folder}/${base}-${index}${ext}`;
    index += 1;
  }
  used.add(name.toLowerCase());
  return name;
}

export async function buildClinicalPackageZipEntries(
  supabase: SupabaseClient,
  clinicId: string,
  snapshot: ClinicalExportSnapshot,
  files: ExportAttachmentFile[],
  sections: ClinicalExportSection[],
  range: ClinicalExportDateRange,
  options?: { skipBinaries?: boolean; remainingBytes?: number }
): Promise<{ entries: ZipStoreEntry[]; warnings: string[]; packedBytes: number }> {
  const warnings = [...snapshot.warnings];
  const used = new Set<string>();
  const entries: ZipStoreEntry[] = [];
  const listed: string[] = [];
  const binaryBudget = options?.remainingBytes ?? ZIP_MAX_BYTES;

  const document = buildClinicalExportDocument(snapshot, sections);
  const patientJson = Buffer.from(JSON.stringify(snapshot.patient, null, 2), "utf8");
  const clinicalJson = Buffer.from(JSON.stringify(document, null, 2), "utf8");
  const pdf = await buildClinicalExportPdf(snapshot);

  entries.push({ name: "Clinical_Record.pdf", data: pdf });
  entries.push({ name: "Data/patient.json", data: patientJson });
  entries.push({ name: "Data/clinical-record.json", data: clinicalJson });
  listed.push("Clinical_Record.pdf", "Data/patient.json", "Data/clinical-record.json");

  const fhirBundle = mapClinicalSnapshotToFhirBundle(snapshot, sections);
  const fhirBundleBytes = Buffer.from(JSON.stringify(fhirBundle, null, 2), "utf8");
  entries.push({ name: "FHIR/bundle.json", data: fhirBundleBytes });
  listed.push("FHIR/bundle.json");
  const fileByType: Record<string, string> = {
    Patient: "patient.json",
    Encounter: "encounters.json",
    Condition: "conditions.json",
    Observation: "observations.json",
  };
  for (const [type, nested] of Object.entries(splitBundleByType(fhirBundle))) {
    const fileName = fileByType[type];
    if (!fileName) continue;
    const path = `FHIR/${fileName}`;
    entries.push({ name: path, data: Buffer.from(JSON.stringify(nested, null, 2), "utf8") });
    listed.push(path);
  }

  let packedBytes = 0;
  let packedFiles = 0;
  const binaries = options?.skipBinaries ? [] : files;
  for (const file of binaries) {
    if (packedFiles >= ZIP_MAX_FILES) {
      warnings.push(`Se omitieron adjuntos extra (máx. ${ZIP_MAX_FILES} archivos).`);
      break;
    }
    if (packedBytes + file.file_size > Math.min(ZIP_MAX_BYTES, binaryBudget)) {
      warnings.push("Se omitieron adjuntos extra (tope de tamaño).");
      break;
    }
    try {
      assertStoragePathInClinic(clinicId, file.file_path);
      const { data, error } = await supabase.storage.from(BUCKET).download(file.file_path);
      if (error || !data) {
        warnings.push(`No se pudo incluir ${file.file_name}.`);
        continue;
      }
      const bytes = new Uint8Array(await data.arrayBuffer());
      packedBytes += bytes.length;
      packedFiles += 1;
      const folder = file.category === "estudio" ? "Studies" : "Documents";
      const name = uniqueEntryName(used, folder, file.file_name);
      entries.push({ name, data: bytes });
      listed.push(name);
    } catch {
      warnings.push(`No se pudo incluir ${file.file_name}.`);
    }
  }

  const manifest = Buffer.from(
    JSON.stringify(
      {
        schema: "drflow.clinical-package.v1",
        generated_at: snapshot.exported_at,
        patient: {
          last_name: snapshot.patient.last_name,
          first_name: snapshot.patient.first_name,
          document_number: snapshot.patient.document_number,
        },
        sections,
        date_range: range.from || range.to ? range : "all",
        files: listed,
        fhir: "r4",
        warnings,
      },
      null,
      2
    ),
    "utf8"
  );
  entries.push({ name: "manifest.json", data: manifest });

  return { entries, warnings, packedBytes };
}

export async function packClinicalExportZip(
  supabase: SupabaseClient,
  clinicId: string,
  snapshot: ClinicalExportSnapshot,
  files: ExportAttachmentFile[],
  sections: ClinicalExportSection[],
  range: ClinicalExportDateRange
): Promise<{ zip: Buffer; warnings: string[] }> {
  const packed = await buildClinicalPackageZipEntries(
    supabase,
    clinicId,
    snapshot,
    files,
    sections,
    range
  );
  return { zip: buildZipStore(packed.entries), warnings: packed.warnings };
}
