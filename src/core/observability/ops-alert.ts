import "server-only";

import { sanitizeMonitoringPayload } from "@/core/observability/sanitize-monitoring-payload";
import { createTraceId } from "@/core/observability/trace-id";

export type OpsAlertSeverity = "critical" | "warning";

export type OpsAlertEventCode =
  | "db_unavailable"
  | "readiness_failure"
  | "clinical_save_failure_spike"
  | "widespread_5xx"
  | "severe_auth_failure"
  | "sustained_latency_breach"
  | "elevated_429"
  | "connection_pressure"
  | "slow_query_regression"
  | "background_job_failure"
  | "backup_verification_failed";

export type OpsAlertPayload = {
  eventCode: OpsAlertEventCode;
  severity: OpsAlertSeverity;
  message: string;
  environment?: string;
  correlationId?: string;
  metadata?: Record<string, unknown>;
};

type DedupEntry = { lastSentAt: number; count: number };

const DEDUP_WINDOW_MS = 5 * 60 * 1000;
const MAX_ALERTS_PER_WINDOW = 3;
const dedupCache = new Map<string, DedupEntry>();

function resolveWebhookUrl(): string | null {
  const url = process.env.OPS_ALERT_WEBHOOK_URL?.trim();
  return url && url.startsWith("http") ? url : null;
}

function resolveEnvironment(): string {
  return (
    process.env.VERCEL_ENV ??
    process.env.DRFLOW_ENV ??
    (process.env.NODE_ENV === "production" ? "production" : "development")
  );
}

function dedupKey(payload: OpsAlertPayload): string {
  return `${payload.eventCode}:${payload.severity}`;
}

function shouldSend(key: string): boolean {
  const now = Date.now();
  const entry = dedupCache.get(key);
  if (!entry || now - entry.lastSentAt > DEDUP_WINDOW_MS) {
    dedupCache.set(key, { lastSentAt: now, count: 1 });
    return true;
  }
  if (entry.count >= MAX_ALERTS_PER_WINDOW) {
    return false;
  }
  entry.count += 1;
  entry.lastSentAt = now;
  return true;
}

/** Safe operational alert — no PHI, rate-limited, non-blocking. */
export async function dispatchOpsAlert(payload: OpsAlertPayload): Promise<boolean> {
  const webhookUrl = resolveWebhookUrl();
  if (!webhookUrl) {
    return false;
  }

  const key = dedupKey(payload);
  if (!shouldSend(key)) {
    return false;
  }

  const correlationId = payload.correlationId ?? createTraceId();
  const body = sanitizeMonitoringPayload({
    type: "drflow_ops_alert",
    event_code: payload.eventCode,
    severity: payload.severity,
    message: payload.message.slice(0, 500),
    environment: payload.environment ?? resolveEnvironment(),
    correlation_id: correlationId,
    timestamp: new Date().toISOString(),
    ...payload.metadata,
  });

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Map health/readiness failure to P0 alert. */
export function alertOnReadinessFailure(details: {
  correlationId?: string;
  checks?: Record<string, unknown>;
}): void {
  void dispatchOpsAlert({
    eventCode: "readiness_failure",
    severity: "critical",
    message: "Health/readiness probe failed",
    correlationId: details.correlationId,
    metadata: { checks: details.checks },
  });
}

/** Map Supabase probe failure to P0 alert. */
export function alertOnDbUnavailable(details: {
  correlationId?: string;
  error?: string;
}): void {
  void dispatchOpsAlert({
    eventCode: "db_unavailable",
    severity: "critical",
    message: details.error ?? "Supabase database unreachable",
    correlationId: details.correlationId,
  });
}

/** Clinical persist failures — P0 when scope matches clinical save path. */
export function alertOnClinicalSaveFailure(scope: string, details: {
  correlationId?: string;
  clinicScopeHash?: string | null;
}): void {
  if (!scope.includes("clinical")) {
    return;
  }
  void dispatchOpsAlert({
    eventCode: "clinical_save_failure_spike",
    severity: "critical",
    message: `Clinical save failure: ${scope}`,
    correlationId: details.correlationId,
    metadata: { scope, clinic_scope_hash: details.clinicScopeHash ?? null },
  });
}

/** Auth infrastructure failures — P0. */
export function alertOnSevereAuthFailure(scope: string, details: {
  correlationId?: string;
}): void {
  if (!/auth|session|login|mfa/i.test(scope)) {
    return;
  }
  void dispatchOpsAlert({
    eventCode: "severe_auth_failure",
    severity: "critical",
    message: `Auth infrastructure failure: ${scope}`,
    correlationId: details.correlationId,
  });
}

/** Reset dedup cache — tests only. */
export function resetOpsAlertDedupForTests(): void {
  dedupCache.clear();
}
