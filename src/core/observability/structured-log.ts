import "server-only";

import { sanitizeMonitoringPayload } from "@/core/observability/sanitize-monitoring-payload";

export type StructuredLogLevel = "debug" | "info" | "warn" | "error";

export type StructuredLogEvent = {
  timestamp: string;
  level: StructuredLogLevel;
  event: string;
  environment: string;
  trace_id?: string | null;
  route?: string | null;
  operation?: string | null;
  clinic_scope_hash?: string | null;
  duration_ms?: number | null;
  status?: string | null;
  error_code?: string | null;
  metadata?: Record<string, unknown>;
};

function resolveEnvironment(): string {
  return process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development";
}

/** Hash clinic id for operational logs — never log raw UUID in external telemetry. */
export function hashClinicScope(clinicId: string | null | undefined): string | null {
  if (!clinicId) return null;
  let hash = 0;
  for (let i = 0; i < clinicId.length; i++) {
    hash = (hash * 31 + clinicId.charCodeAt(i)) >>> 0;
  }
  return `clinic_${hash.toString(16).padStart(8, "0")}`;
}

export function emitStructuredLog(input: Omit<StructuredLogEvent, "timestamp" | "environment">): void {
  const payload: StructuredLogEvent = {
    timestamp: new Date().toISOString(),
    environment: resolveEnvironment(),
    ...input,
    metadata: input.metadata ? sanitizeMonitoringPayload(input.metadata) : undefined,
  };

  const line = JSON.stringify(payload);
  // Structured operational logs use stderr only (code-quality gate + log aggregation).
  console.error(line);
}
