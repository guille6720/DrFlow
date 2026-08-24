/**
 * Phase 7 — Clinical deletion protection helpers (app layer).
 * Hard delete of HC is forbidden; prefer archive / lifecycle statuses.
 * Privacy (habeas data) ≠ automatic destruction of retained clinical records.
 */

export const CLINICAL_LIFECYCLE_STATUSES = [
  "active",
  "archived",
  "superseded",
  "corrected",
] as const;

export type ClinicalLifecycleStatus = (typeof CLINICAL_LIFECYCLE_STATUSES)[number];

export const CLINICAL_HARD_DELETE_ERROR_CODE = "CLINICAL_HARD_DELETE_FORBIDDEN";
export const ISSUED_PRESCRIPTION_DELETE_ERROR_CODE = "ISSUED_PRESCRIPTION_DELETE_FORBIDDEN";

/** Env gate for migration-only mass purge (staging). Never enable in commercial prod. */
export const CLINICAL_HISTORY_RESET_ENV_FLAG = "ALLOW_CLINICAL_HISTORY_RESET";

export function isClinicalHistoryResetEnabled(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  return env[CLINICAL_HISTORY_RESET_ENV_FLAG] === "true";
}

export function isArchivableLifecycle(
  status: string
): status is Exclude<ClinicalLifecycleStatus, "active"> {
  return status === "archived" || status === "superseded" || status === "corrected";
}

export function clinicalLifecycleLabel(status: ClinicalLifecycleStatus): string {
  switch (status) {
    case "active":
      return "Activa";
    case "archived":
      return "Archivada";
    case "superseded":
      return "Reemplazada";
    case "corrected":
      return "Corregida";
    default:
      return status;
  }
}

/**
 * Distinguishes AAIP / Ley 25.326 privacy rights from HC retention (Ley 26.529).
 * Used in docs and UI copy — not legal advice.
 */
export const PRIVACY_VS_RETENTION = {
  privacyRights: [
    "Acceso a datos personales (habeas data / acceso)",
    "Rectificación de datos inexactos",
    "Oposición al tratamiento no necesario",
    "Exportación de la información del titular",
  ],
  retentionObligations: [
    "Conservar historia clínica el mínimo legal configurable del consultorio",
    "No destruir HC, recetas emitidas ni auditoría por un pedido de “borrado” genérico",
    "Preferir baja lógica del paciente (is_active / deactivated_at) sin borrar consultas",
    "Correcciones vía versionado / lifecycle (corrected), no sobreescritura silenciosa",
  ],
  productRule:
    "Un pedido de privacidad NO autoriza automáticamente el hard-delete de registros clínicos que DrFlow o el prestador deben conservar. Ver docs/compliance/CLINICAL-DELETION-PROTECTION-FASE-7.md.",
} as const;

export function isClinicalHardDeleteError(message: string | null | undefined): boolean {
  if (!message) return false;
  return (
    message.includes(CLINICAL_HARD_DELETE_ERROR_CODE) ||
    message.includes(ISSUED_PRESCRIPTION_DELETE_ERROR_CODE) ||
    message.includes("CLINICAL_HARD_DELETE_FORBIDDEN") ||
    message.includes("no pueden modificarse ni eliminarse")
  );
}

export type PurgeClinicClinicalDataResult = {
  clinical_records_deleted: number;
  attachments_deleted: number;
  prescription_drafts_deleted: number;
};

export function parsePurgeClinicClinicalDataResult(
  raw: unknown
): PurgeClinicClinicalDataResult | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const clinical = Number(row.clinical_records_deleted);
  const attachments = Number(row.attachments_deleted);
  const prescriptions = Number(row.prescription_drafts_deleted);
  if (![clinical, attachments, prescriptions].every((n) => Number.isFinite(n))) {
    return null;
  }
  return {
    clinical_records_deleted: clinical,
    attachments_deleted: attachments,
    prescription_drafts_deleted: prescriptions,
  };
}
