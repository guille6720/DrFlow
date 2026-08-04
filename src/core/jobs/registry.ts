/** Async job types — Phase 15 job queue. */
export type ClinicJobType =
  | "send_reminder"
  | "send_email"
  | "generate_report"
  | "import_hce_batch"
  | "import_patients_batch"
  | "import_clinical_pdf"
  | "run_ai_task";

export type ClinicJobStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export type ClinicJobDefinition = {
  id: ClinicJobType;
  label: string;
  description: string;
  defaultMaxAttempts: number;
};

export const CLINIC_JOB_REGISTRY: ClinicJobDefinition[] = [
  {
    id: "send_reminder",
    label: "Recordatorio",
    description: "Envío de recordatorio por email o canal interno.",
    defaultMaxAttempts: 3,
  },
  {
    id: "send_email",
    label: "Email",
    description: "Correo transaccional genérico.",
    defaultMaxAttempts: 3,
  },
  {
    id: "generate_report",
    label: "Reporte",
    description: "Generación de reportes operativos (CSV).",
    defaultMaxAttempts: 2,
  },
  {
    id: "import_hce_batch",
    label: "Importación HCE",
    description: "Lote de importación de historia clínica exportada.",
    defaultMaxAttempts: 2,
  },
  {
    id: "import_patients_batch",
    label: "Importación pacientes",
    description: "Lote de importación de pacientes (Excel/CSV).",
    defaultMaxAttempts: 2,
  },
  {
    id: "import_clinical_pdf",
    label: "Importación PDF",
    description: "Extracción e importación de PDF clínico.",
    defaultMaxAttempts: 2,
  },
  {
    id: "run_ai_task",
    label: "Tarea IA",
    description: "Procesamiento IA asíncrono (resúmenes, sugerencias).",
    defaultMaxAttempts: 2,
  },
];

const JOB_MAP = new Map(CLINIC_JOB_REGISTRY.map((j) => [j.id, j]));

export function getClinicJobDefinition(type: ClinicJobType): ClinicJobDefinition {
  const def = JOB_MAP.get(type);
  if (!def) throw new Error(`Unknown clinic job type: ${type}`);
  return def;
}

export function listClinicJobTypes(): ClinicJobDefinition[] {
  return CLINIC_JOB_REGISTRY;
}

export const JOB_STATUS_LABELS: Record<ClinicJobStatus, string> = {
  pending: "En cola",
  running: "Procesando",
  completed: "Completado",
  failed: "Falló",
  cancelled: "Cancelado",
};
