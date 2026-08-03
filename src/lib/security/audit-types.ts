export type AuditAction = "create" | "update" | "delete" | "view" | "export";

export function sanitizeAuditSnapshot(
  value: Record<string, unknown> | null | undefined,
  maxKeys = 24
): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  const omit = new Set(["evolution", "notes", "medical_history", "regular_medication"]);
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value)) {
    if (omit.has(key) && typeof val === "string" && val.length > 200) {
      out[key] = `${val.slice(0, 200)}… [${val.length} chars]`;
    } else {
      out[key] = val;
    }
    if (Object.keys(out).length >= maxKeys) break;
  }
  return out;
}

export function auditActionLabel(action: string): string {
  const labels: Record<string, string> = {
    create: "Creación",
    update: "Modificación",
    delete: "Eliminación",
    view: "Consulta",
    export: "Exportación",
  };
  return labels[action] ?? action;
}

export function auditEntityLabel(entityType: string): string {
  const labels: Record<string, string> = {
    patient: "Paciente",
    clinical_record: "Consulta clínica",
    prescription: "Receta",
    medical_order: "Orden médica",
    appointment: "Turno",
    patient_attachment: "Adjunto",
    cash_charge: "Cobro",
    clinic: "Consultorio",
    user: "Usuario",
  };
  return labels[entityType] ?? entityType.replace(/_/g, " ");
}

export type PatientAuditEvent = {
  id: string;
  source: "audit_logs" | "clinical_record_audit";
  action: string;
  entityType: string;
  entityId: string | null;
  occurredAt: string;
  actorName: string;
  ipAddress: string | null;
  userAgent: string | null;
  oldValues: Record<string, unknown> | null;
  newValues: Record<string, unknown> | null;
  clinicalRecordId?: string | null;
};

export function mergePatientAuditEvents(
  clinicLogs: Array<{
    id: string;
    action: string;
    entity_type: string;
    entity_id: string | null;
    created_at: string;
    ip_address: string | null;
    user_agent: string | null;
    old_values: Record<string, unknown> | null;
    new_values: Record<string, unknown> | null;
    profiles?: { full_name: string } | { full_name: string }[] | null;
  }>,
  recordLogs: Array<{
    id: string;
    action: string;
    clinical_record_id: string;
    changed_at: string;
    ip_address: string | null;
    user_agent: string | null;
    old_values: Record<string, unknown> | null;
    new_values: Record<string, unknown> | null;
    profiles?: { full_name: string } | { full_name: string }[] | null;
  }>
): PatientAuditEvent[] {
  const fromClinic: PatientAuditEvent[] = clinicLogs.map((row) => {
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    return {
      id: `log-${row.id}`,
      source: "audit_logs",
      action: row.action,
      entityType: row.entity_type,
      entityId: row.entity_id,
      occurredAt: row.created_at,
      actorName: profile?.full_name ?? "Usuario",
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      oldValues: row.old_values,
      newValues: row.new_values,
    };
  });

  const fromRecords: PatientAuditEvent[] = recordLogs.map((row) => {
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    return {
      id: `cra-${row.id}`,
      source: "clinical_record_audit",
      action: row.action,
      entityType: "clinical_record",
      entityId: row.clinical_record_id,
      clinicalRecordId: row.clinical_record_id,
      occurredAt: row.changed_at,
      actorName: profile?.full_name ?? "Usuario",
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      oldValues: row.old_values,
      newValues: row.new_values,
    };
  });

  return [...fromClinic, ...fromRecords].sort(
    (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
  );
}
