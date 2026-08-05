import "server-only";

import { toErrorMessage } from "@/core/errors/error-utils";
import { recordObservabilityEvent } from "@/core/observability/record";
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
 * Standard server-side error logger: stderr + observability event.
 * Non-blocking — safe for audit/background paths that must not throw.
 */
export function logServerError(
  scope: string,
  error: unknown,
  options?: LogServerErrorOptions
): void {
  const message = toErrorMessage(error);
  const metadata = {
    ...options?.metadata,
    stack: error instanceof Error ? error.stack : undefined,
  };

  console.error(`[${scope}]`, message, Object.keys(metadata).length ? metadata : "");

  if (options?.persist === false) return;

  void recordObservabilityEvent({
    clinicId: options?.clinicId ?? null,
    category: options?.category ?? "error",
    name: scope,
    status: "error",
    path: options?.path,
    traceId: options?.traceId,
    errorMessage: message,
    metadata,
  });
}
