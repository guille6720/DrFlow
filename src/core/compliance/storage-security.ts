/**
 * Phase 14 — Supabase Storage security posture for clinical/PHI files.
 * Centralizes bucket rules, path conventions, signed URL TTLs, and public-URL bans.
 * Not legal advice.
 */

import {
  assertExportUrlAllowed,
  EXPORT_SIGNED_URL_TTL_SECONDS,
  isForbiddenPublicStorageUrl,
} from "@/core/compliance/data-export-security";

/** Sole clinical PHI bucket. Must remain private (`public = false`). */
export const CLINICAL_STORAGE_BUCKET = "clinical-files";

/** Temporary download TTL for patient attachments / admin documents (seconds). */
export const CLINICAL_DOWNLOAD_SIGNED_URL_TTL_SECONDS = 15 * 60;

/** Signature image TTL for PDF/print embedding (seconds). */
export const SIGNATURE_SIGNED_URL_TTL_SECONDS = 60 * 60;

export { assertExportUrlAllowed, EXPORT_SIGNED_URL_TTL_SECONDS, isForbiddenPublicStorageUrl };

/** Path zones under `{clinicId}/…` in clinical-files. */
export type ClinicalStoragePathZone =
  | "patients"
  | "admin_legacy"
  | "import_staging"
  | "export_staging"
  | "signatures"
  | "other";

export type ClinicalStorageSecurityRequirement = {
  id: string;
  label: string;
  signals: string[];
};

export const CLINICAL_STORAGE_SECURITY_REQUIREMENTS: ClinicalStorageSecurityRequirement[] = [
  {
    id: "private_bucket",
    label: "Bucket clinical-files no público",
    signals: ["public = false", "CLINICAL_STORAGE_BUCKET", "clinical-files"],
  },
  {
    id: "storage_rls",
    label: "Políticas storage path-aware por clinic_id",
    signals: [
      "can_read_clinical_storage",
      "can_write_clinical_storage",
      "clinical_storage_path_kind",
      "clinical_file_clinic_id",
    ],
  },
  {
    id: "no_object_update",
    label: "Sin UPDATE de objetos (inmutabilidad de blob)",
    signals: ["clinical_files_update", "DROP POLICY"],
  },
  {
    id: "signed_urls_only",
    label: "Descargas vía URL firmada (nunca getPublicUrl)",
    signals: ["createSignedUrl", "createSignedUrls", "getPublicUrl"],
  },
  {
    id: "url_expiry",
    label: "TTL explícito en URLs firmadas",
    signals: [
      "CLINICAL_DOWNLOAD_SIGNED_URL_TTL_SECONDS",
      "EXPORT_SIGNED_URL_TTL_SECONDS",
      "SIGNATURE_SIGNED_URL_TTL_SECONDS",
    ],
  },
  {
    id: "clinic_path_prefix",
    label: "Rutas con prefijo clinic_id + UUID anti-enumeración",
    signals: [
      "assertStoragePathInClinic",
      "buildPatientFilePath",
      "buildProfessionalSignaturePath",
      "randomUUID",
    ],
  },
];

export type ClinicalStorageSurface = {
  id: string;
  label: string;
  pathPattern: string;
  delivery: "signed_url";
  publicForbidden: true;
};

export const CLINICAL_STORAGE_SURFACES: ClinicalStorageSurface[] = [
  {
    id: "patient_attachments",
    label: "Adjuntos clínicos / estudios",
    pathPattern: "{clinicId}/patients/{patientId}/…",
    delivery: "signed_url",
    publicForbidden: true,
  },
  {
    id: "admin_documents",
    label: "Documentos administrativos del paciente",
    pathPattern: "{clinicId}/{patientId}/admin/…",
    delivery: "signed_url",
    publicForbidden: true,
  },
  {
    id: "import_staging",
    label: "Staging de importación",
    pathPattern: "{clinicId}/import-staging/…",
    delivery: "signed_url",
    publicForbidden: true,
  },
  {
    id: "export_staging",
    label: "Staging de exportación",
    pathPattern: "{clinicId}/export-staging/…",
    delivery: "signed_url",
    publicForbidden: true,
  },
  {
    id: "professional_signatures",
    label: "Imágenes de firma profesional",
    pathPattern: "{clinicId}/signatures/{professionalId}/…",
    delivery: "signed_url",
    publicForbidden: true,
  },
];

/** Classify a storage object path (mirrors SQL clinical_storage_path_kind intent). */
export function classifyClinicalStoragePath(path: string): ClinicalStoragePathZone {
  if (/^[^/]+\/import-staging\//.test(path)) return "import_staging";
  if (/^[^/]+\/export-staging\//.test(path)) return "export_staging";
  if (/^[^/]+\/signatures\//.test(path)) return "signatures";
  if (/^[^/]+\/[^/]+\/admin\//.test(path)) return "admin_legacy";
  if (/^[^/]+\/patients\//.test(path)) return "patients";
  return "other";
}

export function assertClinicalStorageUrlAllowed(url: string): void {
  assertExportUrlAllowed(url);
}

export type StorageSecurityPosture = {
  bucket: string;
  publicBucketForbidden: true;
  clinicalDownloadTtlSeconds: number;
  exportStagingTtlSeconds: number;
  signatureTtlSeconds: number;
  surfaceCount: number;
  requirementCount: number;
  notes: string[];
};

export function evaluateStorageSecurityPosture(): StorageSecurityPosture {
  return {
    bucket: CLINICAL_STORAGE_BUCKET,
    publicBucketForbidden: true,
    clinicalDownloadTtlSeconds: CLINICAL_DOWNLOAD_SIGNED_URL_TTL_SECONDS,
    exportStagingTtlSeconds: EXPORT_SIGNED_URL_TTL_SECONDS,
    signatureTtlSeconds: SIGNATURE_SIGNED_URL_TTL_SECONDS,
    surfaceCount: CLINICAL_STORAGE_SURFACES.length,
    requirementCount: CLINICAL_STORAGE_SECURITY_REQUIREMENTS.length,
    notes: [
      "Un único bucket clínico privado: clinical-files.",
      "RLS de storage clasifica rutas (patients/admin/staging/signatures).",
      "Descargas usan createSignedUrl con TTL; getPublicUrl está prohibido en app.",
      "Prefijo clinic_id + UUID en nombres reduce rutas predecibles.",
      "No hay caso de uso justificado para objetos clínicos públicos.",
    ],
  };
}
