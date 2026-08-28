import "server-only";

import { toErrorMessage } from "@/core/errors/error-utils";
import { recordObservabilityEvent } from "@/core/observability/record";
import { getRequestTraceId } from "@/core/observability/request-trace";
import { sanitizeTelemetryMetadata } from "@/core/observability/sanitize-monitoring-payload";
import { captureServerException } from "@/core/observability/sentry.server";
import { emitStructuredLog, hashClinicScope } from "@/core/observability/structured-log";
import type { ObservabilityCategory } from "@/core/observability/types";

export type LogServerErrorOptions = {
  clinicId?: string | null;
  metadata?: Record<string, unknown>;
  category?: ObservabilityCategory;
  traceId?: string;
  path?: string;
  /** When false, skip observability persistence (e.g. observability layer itself). */
  persist?: boolean;
};

/**
 * Standard server-side error logger: structured log + observability event + Sentry.
 * Non-blocking — safe for audit/background paths that must not throw.
 */
export function logServerError(
  scope: string,
  error: unknown,
  options?: LogServerErrorOptions
): void {
  void logServerErrorAsync(scope, error, options);
}

async function logServerErrorAsync(
  scope: string,
  error: unknown,
  options?: LogServerErrorOptions
): Promise<void> {
  const message = toErrorMessage(error);
  const traceId = options?.traceId ?? (await getRequestTraceId());
  const rawMetadata = {
    ...options?.metadata,
    stack: error instanceof Error ? error.stack : undefined,
  };
  const metadata = sanitizeTelemetryMetadata(rawMetadata) ?? {};

  emitStructuredLog({
    level: "error",
    event: scope,
    trace_id: traceId ?? null,
    route: options?.path ?? null,
    operation: scope,
    clinic_scope_hash: hashClinicScope(options?.clinicId),
    status: "error",
    error_code: message.slice(0, 120),
    metadata,
  });

  if (options?.persist === false) {
    captureServerException(error, {
      scope,
      clinicId: options?.clinicId,
      path: options?.path,
      traceId,
      metadata,
    });
    return;
  }

  void recordObservabilityEvent({
    clinicId: options?.clinicId ?? null,
    category: options?.category ?? "error",
    name: scope,
    status: "error",
    path: options?.path,
    traceId,
    errorMessage: message.slice(0, 500),
    metadata,
  });

  captureServerException(error, {
    scope,
    clinicId: options?.clinicId,
    path: options?.path,
    traceId,
    metadata,
  });
}
