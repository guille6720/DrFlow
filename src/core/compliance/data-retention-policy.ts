import { CLINICAL_RECORD_RETENTION_YEARS } from "@/core/legal/documents";

/**
 * Phase 8 — Centralized clinical retention configuration.
 *
 * Single source of truth for retention windows. Prefer importing from this module
 * instead of hard-coding year literals elsewhere.
 *
 * Anchor rule (product assumption, aligned with project docs):
 * retention runs for N years counted from the patient's **last clinical entry**,
 * not from first visit or account creation.
 *
 * DrFlow does **not** auto-purge clinical records when the window elapses.
 * Preservation during the window is enforced by soft-delete / immutable audit
 * (see Phase 7). Destruction after the window is an operational/legal decision
 * outside automated product jobs.
 */

export const RETENTION_YEARS_MIN = 5;
export const RETENTION_YEARS_MAX = 30;

/** Default product assumption when clinic has not configured a value. */
export const DEFAULT_CLINICAL_RETENTION_YEARS = CLINICAL_RECORD_RETENTION_YEARS; // 10

export type RetentionAnchor = "last_clinical_entry" | "record_created_at";

/** Canonical retention policy (do not scatter these values in feature code). */
export const CLINICAL_RETENTION_POLICY = {
  defaultYears: DEFAULT_CLINICAL_RETENTION_YEARS,
  minYears: RETENTION_YEARS_MIN,
  maxYears: RETENTION_YEARS_MAX,
  /** Primary clock for HC conservation obligations. */
  patientHistoryAnchor: "last_clinical_entry" as RetentionAnchor,
  /**
   * Per-row created_at is used only for inventory/statistics of individual notes.
   * Patient-level obligations use last_clinical_entry.
   */
  individualRecordAnchor: "record_created_at" as RetentionAnchor,
  legalReference: "Ley 26.529 / práctica habitual — mínimo configurable por consultorio",
  autoPurgeEnabled: false as const,
  autoPurgeNote:
    "DrFlow no ejecuta jobs de destrucción automática de HC al vencer el plazo. La conservación es el comportamiento por defecto.",
} as const;

export type DataRetentionCategory = {
  id: string;
  label: string;
  description: string;
  retentionYears: number | "permanent" | "legal_minimum";
  deletionPolicy: "soft_delete_only" | "immutable" | "export_before_delete";
};

/** Product policy matrix — displayed in Configuración → Cumplimiento legal. */
export const DATA_RETENTION_CATEGORIES: DataRetentionCategory[] = [
  {
    id: "clinical_records",
    label: "Historias clínicas",
    description:
      "Consultas SOAP, evoluciones, diagnósticos e indicaciones. Reloj: desde la última consulta del paciente.",
    retentionYears: "legal_minimum",
    deletionPolicy: "immutable",
  },
  {
    id: "prescriptions",
    label: "Recetas emitidas",
    description: "Prescripciones con número, medicación y trazabilidad.",
    retentionYears: "legal_minimum",
    deletionPolicy: "immutable",
  },
  {
    id: "audit_logs",
    label: "Auditoría y accesos",
    description: "Registro inmutable de mutaciones y lecturas sensibles.",
    retentionYears: "permanent",
    deletionPolicy: "immutable",
  },
  {
    id: "consent_records",
    label: "Consentimientos",
    description: "Turnos web, consentimiento informado y aceptaciones legales.",
    retentionYears: "permanent",
    deletionPolicy: "immutable",
  },
  {
    id: "patients",
    label: "Ficha del paciente",
    description: "Demografía y datos de contacto (baja lógica; HC se conserva).",
    retentionYears: "legal_minimum",
    deletionPolicy: "soft_delete_only",
  },
  {
    id: "appointments",
    label: "Turnos",
    description: "Agenda, asistencia y cancelaciones.",
    retentionYears: "legal_minimum",
    deletionPolicy: "soft_delete_only",
  },
  {
    id: "attachments",
    label: "Adjuntos clínicos",
    description: "PDFs e imágenes vinculados a la historia clínica.",
    retentionYears: "legal_minimum",
    deletionPolicy: "export_before_delete",
  },
];

export function normalizeRetentionYears(value: number | null | undefined): number {
  const years = value ?? CLINICAL_RETENTION_POLICY.defaultYears;
  if (!Number.isFinite(years)) return CLINICAL_RETENTION_POLICY.defaultYears;
  return Math.min(
    CLINICAL_RETENTION_POLICY.maxYears,
    Math.max(CLINICAL_RETENTION_POLICY.minYears, Math.round(years))
  );
}

/** Retention end date counted from an anchor timestamp. */
export function clinicalRecordRetentionUntil(
  anchorAt: string | Date,
  retentionYears: number
): Date {
  const base = anchorAt instanceof Date ? new Date(anchorAt) : new Date(anchorAt);
  const until = new Date(base);
  until.setFullYear(until.getFullYear() + retentionYears);
  return until;
}

export function isWithinClinicalRetentionPeriod(
  anchorAt: string | Date,
  retentionYears: number,
  now: Date = new Date()
): boolean {
  return now < clinicalRecordRetentionUntil(anchorAt, retentionYears);
}

/**
 * Patient-level HC retention: clock starts at the **last clinical entry**.
 * If the patient has no clinical records, returns null (nothing to retain clinically).
 */
export function patientHistoryRetentionUntil(
  lastClinicalEntryAt: string | Date | null | undefined,
  retentionYears: number
): Date | null {
  if (!lastClinicalEntryAt) return null;
  return clinicalRecordRetentionUntil(lastClinicalEntryAt, retentionYears);
}

export function isPatientHistoryWithinRetention(
  lastClinicalEntryAt: string | Date | null | undefined,
  retentionYears: number,
  now: Date = new Date()
): boolean {
  const until = patientHistoryRetentionUntil(lastClinicalEntryAt, retentionYears);
  if (!until) return false;
  return now < until;
}

export function latestClinicalEntryAt(recordCreatedAts: string[]): string | null {
  if (recordCreatedAts.length === 0) return null;
  return recordCreatedAts.reduce((latest, current) =>
    new Date(current).getTime() > new Date(latest).getTime() ? current : latest
  );
}

export function retentionCategoryYearsLabel(
  category: DataRetentionCategory,
  clinicRetentionYears: number
): string {
  if (category.retentionYears === "permanent") return "Conservación indefinida";
  if (category.retentionYears === "legal_minimum") {
    return `Mínimo ${clinicRetentionYears} años (configurable)`;
  }
  return `${category.retentionYears} años`;
}

export function deletionPolicyLabel(policy: DataRetentionCategory["deletionPolicy"]): string {
  switch (policy) {
    case "immutable":
      return "No eliminable — solo consulta y exportación";
    case "soft_delete_only":
      return "Baja lógica — datos clínicos vinculados se conservan";
    case "export_before_delete":
      return "Eliminación individual con registro en auditoría";
    default:
      return policy;
  }
}

export type PatientDeactivationEvaluation = {
  retentionYears: number;
  clinicalRecordCount: number;
  recordsWithinRetention: number;
  latestRecordAt: string | null;
  historyRetentionUntil: string | null;
  requiresRetentionAcknowledgment: boolean;
  warningMessage: string | null;
};

export function buildPatientDeactivationEvaluation(params: {
  retentionYears: number;
  clinicalRecordCount: number;
  recordsWithinRetention: number;
  latestRecordAt: string | null;
}): PatientDeactivationEvaluation {
  const requiresRetentionAcknowledgment = params.clinicalRecordCount > 0;
  const historyUntil = patientHistoryRetentionUntil(
    params.latestRecordAt,
    params.retentionYears
  );
  let warningMessage: string | null = null;

  if (params.clinicalRecordCount > 0) {
    const untilLabel = historyUntil
      ? ` Conservación de HC hasta ${historyUntil.toISOString().slice(0, 10)} (desde última consulta).`
      : "";
    warningMessage =
      params.recordsWithinRetention > 0
        ? `Este paciente tiene ${params.recordsWithinRetention} consulta(s) dentro del período de retención (${params.retentionYears} años desde la última consulta). La baja oculta la ficha pero no elimina historias clínicas, recetas ni auditoría.${untilLabel}`
        : `La ficha se ocultará del listado. Las ${params.clinicalRecordCount} consulta(s) registradas y la auditoría se conservan según la política del consultorio.${untilLabel}`;
  }

  return {
    retentionYears: params.retentionYears,
    clinicalRecordCount: params.clinicalRecordCount,
    recordsWithinRetention: params.recordsWithinRetention,
    latestRecordAt: params.latestRecordAt,
    historyRetentionUntil: historyUntil ? historyUntil.toISOString() : null,
    requiresRetentionAcknowledgment,
    warningMessage,
  };
}

export type RetentionPreservationStatus = {
  defaultYears: number;
  autoPurgeEnabled: false;
  patientHistoryAnchor: RetentionAnchor;
  meetsMinimumAssumption: boolean;
  notes: string[];
};

/**
 * Technical verification that the product supports ≥ default legal retention.
 * Does not certify legal compliance by itself.
 */
export function evaluateRetentionPreservationSupport(
  clinicRetentionYears: number
): RetentionPreservationStatus {
  const years = normalizeRetentionYears(clinicRetentionYears);
  const meetsMinimumAssumption = years >= CLINICAL_RETENTION_POLICY.defaultYears;
  const notes: string[] = [
    CLINICAL_RETENTION_POLICY.autoPurgeNote,
    `Ancla de HC: ${CLINICAL_RETENTION_POLICY.patientHistoryAnchor} (última consulta).`,
    `Configuración del consultorio: ${years} años (rango ${CLINICAL_RETENTION_POLICY.minYears}–${CLINICAL_RETENTION_POLICY.maxYears}).`,
  ];
  if (!meetsMinimumAssumption) {
    notes.push(
      `Aviso: el consultorio configuró ${years} años, por debajo del default de producto (${CLINICAL_RETENTION_POLICY.defaultYears}). Revisar con asesoramiento legal.`
    );
  }
  return {
    defaultYears: CLINICAL_RETENTION_POLICY.defaultYears,
    autoPurgeEnabled: false,
    patientHistoryAnchor: CLINICAL_RETENTION_POLICY.patientHistoryAnchor,
    meetsMinimumAssumption,
    notes,
  };
}
