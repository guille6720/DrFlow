import { CLINICAL_RECORD_RETENTION_YEARS } from "@/core/legal/documents";

export const RETENTION_YEARS_MIN = 5;
export const RETENTION_YEARS_MAX = 30;

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
    description: "Consultas SOAP, evoluciones, diagnósticos e indicaciones.",
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
    description: "Demografía y datos de contacto.",
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
  const years = value ?? CLINICAL_RECORD_RETENTION_YEARS;
  if (!Number.isFinite(years)) return CLINICAL_RECORD_RETENTION_YEARS;
  return Math.min(RETENTION_YEARS_MAX, Math.max(RETENTION_YEARS_MIN, Math.round(years)));
}

export function clinicalRecordRetentionUntil(
  createdAt: string | Date,
  retentionYears: number
): Date {
  const base = createdAt instanceof Date ? createdAt : new Date(createdAt);
  const until = new Date(base);
  until.setFullYear(until.getFullYear() + retentionYears);
  return until;
}

export function isWithinClinicalRetentionPeriod(
  createdAt: string | Date,
  retentionYears: number,
  now: Date = new Date()
): boolean {
  return now < clinicalRecordRetentionUntil(createdAt, retentionYears);
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
  let warningMessage: string | null = null;

  if (params.clinicalRecordCount > 0) {
    warningMessage =
      params.recordsWithinRetention > 0
        ? `Este paciente tiene ${params.recordsWithinRetention} consulta(s) dentro del período de retención (${params.retentionYears} años). La baja oculta la ficha pero no elimina historias clínicas, recetas ni auditoría.`
        : `La ficha se ocultará del listado. Las ${params.clinicalRecordCount} consulta(s) registradas y la auditoría se conservan según la política del consultorio.`;
  }

  return {
    retentionYears: params.retentionYears,
    clinicalRecordCount: params.clinicalRecordCount,
    recordsWithinRetention: params.recordsWithinRetention,
    latestRecordAt: params.latestRecordAt,
    requiresRetentionAcknowledgment,
    warningMessage,
  };
}
