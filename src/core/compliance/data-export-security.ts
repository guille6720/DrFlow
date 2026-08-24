/**
 * Phase 13 — Data export security posture for health/PHI exports.
 * Centralizes rules: auth, authz, tenant isolation, audit, no public URLs, TTL, no-store.
 * Not legal advice.
 */

/** Temporary signed URL lifetime for clinical export staging objects (seconds). */
export const EXPORT_SIGNED_URL_TTL_SECONDS = 10 * 60;

/** Storage prefix under `{clinicId}/` for ephemeral export artifacts. */
export const EXPORT_STAGING_PATH_SEGMENT = "export-staging";

export const EXPORT_CACHE_CONTROL_NO_STORE = "private, no-store, no-cache, must-revalidate";

export type HealthExportChannel =
  | "patient_roster_csv_xlsx"
  | "clinical_package_inline"
  | "clinical_package_signed_url"
  | "bulk_clinical_job"
  | "arco_habeas_json"
  | "prescription_pdf"
  | "informed_consent_pdf";

export type HealthExportSecurityRequirement = {
  id: string;
  label: string;
  /** Code / migration signals verified by static tests. */
  signals: string[];
};

/** Required controls for any export that may contain health or identity data. */
export const HEALTH_EXPORT_SECURITY_REQUIREMENTS: HealthExportSecurityRequirement[] = [
  {
    id: "authentication",
    label: "Sesión autenticada",
    signals: ["getSession", "requireClinicPermission", "requirePatientExportAccess"],
  },
  {
    id: "authorization",
    label: "Permiso / entitlement de exportación",
    signals: [
      "requireClinicalExportAccess",
      "requireBulkExportAccess",
      "requirePatientExportAccess",
      "FEATURES.DATA_EXPORT",
    ],
  },
  {
    id: "tenant_isolation",
    label: "Aislamiento por clinic_id",
    signals: ["verifyPatientInClinic", "eq(\"clinic_id\"", "assertStoragePathInClinic"],
  },
  {
    id: "audit",
    label: "Registro de auditoría inmutable",
    signals: ["recordAudit", "logAudit", "action: \"export\"", "action: 'export'"],
  },
  {
    id: "no_public_urls",
    label: "Sin URLs públicas de storage",
    signals: ["createSignedUrl", "EXPORT_SIGNED_URL_TTL_SECONDS", "getPublicUrl"],
  },
  {
    id: "url_expiry",
    label: "TTL corto en URLs temporales",
    signals: ["EXPORT_SIGNED_URL_TTL_SECONDS", "export-staging"],
  },
  {
    id: "no_store_cache",
    label: "Evitar caché no autorizado en descargas",
    signals: ["EXPORT_CACHE_CONTROL_NO_STORE", "cache: \"no-store\""],
  },
];

export type HealthExportChannelPolicy = {
  channel: HealthExportChannel;
  label: string;
  delivery: "inline_base64" | "blob_download" | "signed_url";
  containsPhi: boolean;
  mustAudit: true;
  publicUrlForbidden: true;
};

export const HEALTH_EXPORT_CHANNELS: HealthExportChannelPolicy[] = [
  {
    channel: "patient_roster_csv_xlsx",
    label: "Padrón de pacientes (CSV/XLSX)",
    delivery: "inline_base64",
    containsPhi: true,
    mustAudit: true,
    publicUrlForbidden: true,
  },
  {
    channel: "clinical_package_inline",
    label: "Historia clínica JSON/PDF/FHIR (inline)",
    delivery: "inline_base64",
    containsPhi: true,
    mustAudit: true,
    publicUrlForbidden: true,
  },
  {
    channel: "clinical_package_signed_url",
    label: "Historia clínica ZIP (URL firmada)",
    delivery: "signed_url",
    containsPhi: true,
    mustAudit: true,
    publicUrlForbidden: true,
  },
  {
    channel: "bulk_clinical_job",
    label: "Exportación masiva asíncrona",
    delivery: "signed_url",
    containsPhi: true,
    mustAudit: true,
    publicUrlForbidden: true,
  },
  {
    channel: "arco_habeas_json",
    label: "Exportación ARCO / Habeas Data",
    delivery: "inline_base64",
    containsPhi: true,
    mustAudit: true,
    publicUrlForbidden: true,
  },
  {
    channel: "prescription_pdf",
    label: "PDF de receta",
    delivery: "blob_download",
    containsPhi: true,
    mustAudit: true,
    publicUrlForbidden: true,
  },
  {
    channel: "informed_consent_pdf",
    label: "PDF consentimiento informado",
    delivery: "blob_download",
    containsPhi: true,
    mustAudit: true,
    publicUrlForbidden: true,
  },
];

/** Reject accidental use of Supabase public object URLs for PHI. */
export function isForbiddenPublicStorageUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.pathname.includes("/storage/v1/object/public/") ||
      parsed.pathname.includes("/object/public/")
    );
  } catch {
    return /\/object\/public\//i.test(url);
  }
}

export function assertExportUrlAllowed(url: string): void {
  if (isForbiddenPublicStorageUrl(url)) {
    throw new Error("EXPORT_PUBLIC_URL_FORBIDDEN: las exportaciones clínicas no pueden usar URLs públicas.");
  }
}

export function buildExportAuditMetadata(input: {
  channel: HealthExportChannel;
  format?: string;
  recordCount?: number;
  extra?: Record<string, unknown>;
}): Record<string, unknown> {
  return {
    export_channel: input.channel,
    format: input.format ?? null,
    record_count: input.recordCount ?? null,
    signed_url_ttl_seconds: EXPORT_SIGNED_URL_TTL_SECONDS,
    cache_control: EXPORT_CACHE_CONTROL_NO_STORE,
    public_url_forbidden: true,
    ...input.extra,
  };
}

export type DataExportSecurityPosture = {
  signedUrlTtlSeconds: number;
  publicUrlsForbidden: true;
  cacheControl: string;
  channelCount: number;
  requirementCount: number;
  notes: string[];
};

export function evaluateDataExportSecurityPosture(): DataExportSecurityPosture {
  return {
    signedUrlTtlSeconds: EXPORT_SIGNED_URL_TTL_SECONDS,
    publicUrlsForbidden: true,
    cacheControl: EXPORT_CACHE_CONTROL_NO_STORE,
    channelCount: HEALTH_EXPORT_CHANNELS.length,
    requirementCount: HEALTH_EXPORT_SECURITY_REQUIREMENTS.length,
    notes: [
      "Exports PHI requieren auth + permiso + clinic_id + auditoría.",
      "Artefactos grandes usan storage staging con URL firmada de corta duración.",
      "Descargas inline (base64) no publican objetos en buckets públicos.",
      "CSV/XLSX neutralizan inyección de fórmulas (spreadsheet-export-safety).",
    ],
  };
}
