/** Phase 4 — initial observability thresholds (not final production SLOs). */

export type OperationKind = "read" | "write";

export type CriticalOperation =
  | "dashboard.load"
  | "patient.search"
  | "patient.workspace"
  | "clinical.history"
  | "clinical.consultation.save"
  | "clinical.soap.save"
  | "clinical.diagnosis.save"
  | "prescription.save"
  | "appointments.load"
  | "auth.session"
  | "bulk.export"
  | "import.job";

export const OPERATION_THRESHOLDS_MS: Record<
  OperationKind,
  { warn: number; critical: number }
> = {
  read: { warn: 1000, critical: 2000 },
  write: { warn: 1500, critical: 3000 },
};

export const CRITICAL_OPERATION_KIND: Record<CriticalOperation, OperationKind> = {
  "dashboard.load": "read",
  "patient.search": "read",
  "patient.workspace": "read",
  "clinical.history": "read",
  "clinical.consultation.save": "write",
  "clinical.soap.save": "write",
  "clinical.diagnosis.save": "write",
  "prescription.save": "write",
  "appointments.load": "read",
  "auth.session": "read",
  "bulk.export": "write",
  "import.job": "write",
};

export function classifyOperationDuration(
  operation: CriticalOperation,
  durationMs: number
): "ok" | "warn" | "critical" {
  const kind = CRITICAL_OPERATION_KIND[operation];
  const { warn, critical } = OPERATION_THRESHOLDS_MS[kind];
  if (durationMs >= critical) return "critical";
  if (durationMs >= warn) return "warn";
  return "ok";
}
