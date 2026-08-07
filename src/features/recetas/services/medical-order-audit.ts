import { auditFieldChanges } from "@/core/security/audit-log";
import { recordAudit } from "@/core/security/audit-service";

import type { MedicalOrder, MedicalOrderStatus } from "@/types/medical-order";

/** Campos clínicos/editables de una orden médica incluidos en el trail inmutable. */
export const MEDICAL_ORDER_AUDIT_FIELD_KEYS = [
  "patient_id",
  "clinical_record_id",
  "professional_id",
  "order_type",
  "order_text",
  "notes",
  "status",
] as const;

export type MedicalOrderAuditSnapshot = {
  patient_id: string;
  clinical_record_id: string | null;
  professional_id: string;
  order_type: string;
  order_text: string;
  notes: string | null;
  status: MedicalOrderStatus;
};

type MedicalOrderAuditRow = Partial<MedicalOrder> & {
  patient_id: string;
  professional_id: string;
  order_text: string;
  status: MedicalOrderStatus;
};

export function toMedicalOrderAuditSnapshot(row: MedicalOrderAuditRow): MedicalOrderAuditSnapshot {
  return {
    patient_id: row.patient_id,
    clinical_record_id: row.clinical_record_id ?? null,
    professional_id: row.professional_id,
    order_type: row.order_type ?? "study",
    order_text: row.order_text,
    notes: row.notes ?? null,
    status: row.status,
  };
}

function listChangedFieldKeys(
  oldValues: Record<string, unknown> | null,
  newValues: Record<string, unknown> | null
): string[] {
  if (!oldValues && !newValues) return [];
  return [
    ...new Set([
      ...Object.keys(oldValues ?? {}),
      ...Object.keys(newValues ?? {}),
    ]),
  ];
}

type MedicalOrderAuditBase = {
  clinicId: string;
  entityId: string;
  patientId: string;
};

export async function recordMedicalOrderCreateAudit(
  params: MedicalOrderAuditBase & { order: MedicalOrderAuditRow }
): Promise<void> {
  const after = toMedicalOrderAuditSnapshot(params.order);
  const { oldValues, newValues } = auditFieldChanges(
    null,
    after,
    [...MEDICAL_ORDER_AUDIT_FIELD_KEYS]
  );

  await recordAudit({
    clinicId: params.clinicId,
    module: "orders",
    entityType: "medical_order",
    entityId: params.entityId,
    patientId: params.patientId,
    action: "create",
    oldValues,
    newValues,
    metadata: {
      changed_fields: listChangedFieldKeys(oldValues, newValues),
    },
  });
}

export async function recordMedicalOrderUpdateAudit(
  params: MedicalOrderAuditBase & {
    before: MedicalOrderAuditRow;
    after: MedicalOrderAuditRow;
  }
): Promise<void> {
  const before = toMedicalOrderAuditSnapshot(params.before);
  const after = toMedicalOrderAuditSnapshot(params.after);
  const { oldValues, newValues } = auditFieldChanges(
    before,
    after,
    [...MEDICAL_ORDER_AUDIT_FIELD_KEYS]
  );

  if (!oldValues && !newValues) return;

  await recordAudit({
    clinicId: params.clinicId,
    module: "orders",
    entityType: "medical_order",
    entityId: params.entityId,
    patientId: params.patientId,
    action: "update",
    oldValues,
    newValues,
    metadata: {
      changed_fields: listChangedFieldKeys(oldValues, newValues),
    },
  });
}

export async function recordMedicalOrderVoidAudit(
  params: MedicalOrderAuditBase & { before: MedicalOrderAuditRow }
): Promise<void> {
  const before = toMedicalOrderAuditSnapshot(params.before);
  const after: MedicalOrderAuditSnapshot = { ...before, status: "void" };
  const { oldValues, newValues } = auditFieldChanges(
    before,
    after,
    [...MEDICAL_ORDER_AUDIT_FIELD_KEYS]
  );

  await recordAudit({
    clinicId: params.clinicId,
    module: "orders",
    entityType: "medical_order",
    entityId: params.entityId,
    patientId: params.patientId,
    action: "delete",
    oldValues,
    newValues,
    metadata: {
      changed_fields: listChangedFieldKeys(oldValues, newValues),
    },
  });
}
