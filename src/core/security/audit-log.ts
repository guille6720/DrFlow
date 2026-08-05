import {
  type AuditAction,
  auditActionLabel,
  auditEntityLabel,
  sanitizeAuditSnapshot,
} from "@/core/security/audit-types";

/** Functional modules for immutable audit trail grouping. */
export const AUDIT_MODULES = [
  "clinical",
  "patients",
  "appointments",
  "prescriptions",
  "orders",
  "cash",
  "admin_docs",
  "attachments",
  "auth",
  "compliance",
  "settings",
  "imports",
  "jobs",
  "plugins",
  "waiting_room",
  "system",
] as const;

export type AuditModule = (typeof AUDIT_MODULES)[number];

export type ImmutableAuditParams = {
  clinicId?: string;
  module?: AuditModule;
  /** Human-readable description of what happened. */
  what?: string;
  entityType: string;
  entityId?: string;
  patientId?: string;
  action: AuditAction;
  metadata?: Record<string, unknown>;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  userId: string;
};

const ENTITY_MODULE_MAP: Record<string, AuditModule> = {
  clinical_record: "clinical",
  patient: "patients",
  appointment: "appointments",
  prescription: "prescriptions",
  prescription_draft: "prescriptions",
  medical_order: "orders",
  patient_attachment: "attachments",
  patient_admin_document: "admin_docs",
  cash_charge: "cash",
  patient_ledger: "cash",
  cash_invoice: "cash",
  cash_daily_closure: "cash",
  clinic: "settings",
  user: "auth",
  consent: "compliance",
  clinic_job: "jobs",
  clinic_plugin: "plugins",
  clinic_feature_flag: "plugins",
  clinic_invitation: "settings",
  clinic_member: "settings",
  waiting_room: "waiting_room",
};

export function deriveAuditModule(entityType: string): AuditModule {
  return ENTITY_MODULE_MAP[entityType] ?? "system";
}

export function buildAuditWhat(
  action: AuditAction,
  entityType: string,
  explicit?: string
): string {
  if (explicit?.trim()) return explicit.trim();
  return `${auditActionLabel(action)} — ${auditEntityLabel(entityType)}`;
}

/** Build old/new snapshots from changed field keys. */
export function auditFieldChanges<T extends Record<string, unknown>>(
  before: T | null | undefined,
  after: T | null | undefined,
  keys: (keyof T)[]
): { oldValues: Record<string, unknown> | null; newValues: Record<string, unknown> | null } {
  const oldValues: Record<string, unknown> = {};
  const newValues: Record<string, unknown> = {};
  let changed = false;

  for (const key of keys) {
    const k = String(key);
    const oldVal = before?.[key];
    const newVal = after?.[key];
    if (JSON.stringify(oldVal ?? null) !== JSON.stringify(newVal ?? null)) {
      changed = true;
      if (oldVal !== undefined) oldValues[k] = oldVal as unknown;
      if (newVal !== undefined) newValues[k] = newVal as unknown;
    }
  }

  return {
    oldValues: changed ? sanitizeAuditSnapshot(oldValues) : null,
    newValues: changed ? sanitizeAuditSnapshot(newValues) : null,
  };
}

export function auditModuleLabel(module: string): string {
  const labels: Record<string, string> = {
    clinical: "Clínico",
    patients: "Pacientes",
    appointments: "Turnos",
    prescriptions: "Recetas",
    orders: "Órdenes",
    cash: "Caja",
    admin_docs: "Documentos admin.",
    attachments: "Adjuntos",
    auth: "Autenticación",
    compliance: "Cumplimiento",
    settings: "Configuración",
    imports: "Importaciones",
    jobs: "Trabajos",
    plugins: "Plugins",
    waiting_room: "Sala de espera",
    system: "Sistema",
  };
  return labels[module] ?? module;
}

/** Row payload for audit_logs INSERT (immutable — no updates). */
export function buildAuditLogRow(params: ImmutableAuditParams) {
  const auditModule = params.module ?? deriveAuditModule(params.entityType);
  const what = buildAuditWhat(params.action, params.entityType, params.what);
  const patientId =
    params.patientId ??
    (params.entityType === "patient" ? params.entityId : undefined);

  return {
    clinic_id: params.clinicId ?? null,
    user_id: params.userId,
    module: auditModule,
    what,
    entity_type: params.entityType,
    entity_id: params.entityId ?? null,
    patient_id: patientId ?? null,
    action: params.action,
    metadata: params.metadata ?? {},
    old_values: sanitizeAuditSnapshot(params.oldValues ?? null),
    new_values: sanitizeAuditSnapshot(params.newValues ?? null),
    ip_address: params.ipAddress ?? null,
    user_agent: params.userAgent ?? null,
  };
}

export type ClinicalRecordAuditParams = {
  clinicalRecordId: string;
  clinicId: string;
  patientId?: string;
  action: AuditAction;
  what?: string;
  changedBy: string;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export function buildClinicalRecordAuditRow(params: ClinicalRecordAuditParams) {
  return {
    clinical_record_id: params.clinicalRecordId,
    clinic_id: params.clinicId,
    patient_id: params.patientId ?? null,
    module: "clinical" as const,
    what: params.what ?? buildAuditWhat(params.action, "clinical_record"),
    action: params.action,
    changed_by: params.changedBy,
    old_values: sanitizeAuditSnapshot(params.oldValues ?? null),
    new_values: sanitizeAuditSnapshot(params.newValues ?? null),
    ip_address: params.ipAddress ?? null,
    user_agent: params.userAgent ?? null,
  };
}
