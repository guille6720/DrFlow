import { requireAnyClinicPermission, requireClinicPermission } from "@/core/actions/clinic-guard";

export type ImportAccessResult =
  | { error: null; clinicId: string; userId: string }
  | { error: "Sin permisos" | "Sesión requerida"; clinicId: null; userId: null };

function toImportAccess(
  access:
    | { ok: true; clinicId: string; userId: string }
    | { ok: false; error: string }
): ImportAccessResult {
  if (!access.ok) {
    return {
      error: access.error === "Sin sesión" ? "Sesión requerida" : "Sin permisos",
      clinicId: null,
      userId: null,
    };
  }
  return { error: null, clinicId: access.clinicId, userId: access.userId };
}

/** Gate for clinical CSV/HCE/JSONL/PDF import pipelines. */
export async function requireClinicalImportAccess(): Promise<ImportAccessResult> {
  return toImportAccess(await requireClinicPermission("importClinicalRecords"));
}

/** Gate for spreadsheet patient roster imports. */
export async function requirePatientImportAccess(): Promise<ImportAccessResult> {
  return toImportAccess(await requireClinicPermission("importPatients"));
}

export async function requirePatientExportAccess(): Promise<ImportAccessResult> {
  return toImportAccess(await requireClinicPermission("exportPatients"));
}

export async function requireClinicalExportAccess(): Promise<ImportAccessResult> {
  return toImportAccess(await requireClinicPermission("exportClinicalRecords"));
}

export async function requireBulkExportAccess(): Promise<ImportAccessResult> {
  return toImportAccess(await requireClinicPermission("bulkExportData"));
}

export async function requireImportExportHubAccess(): Promise<ImportAccessResult> {
  return toImportAccess(
    await requireAnyClinicPermission([
      "importPatients",
      "exportPatients",
      "importClinicalRecords",
      "exportClinicalRecords",
      "bulkExportData",
    ])
  );
}
