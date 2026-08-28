import { toErrorMessage } from "@/core/errors/error-utils";
import { reportClientObservabilityEvent } from "@/core/observability/client-reporter";
import { sanitizeTelemetryMetadata } from "@/core/observability/sanitize-monitoring-payload";
import { captureClientException } from "@/core/observability/sentry.client";

/** Client-side diagnostic logging (console.error allowed by eslint). */
export function logClientError(
  scope: string,
  error: unknown,
  metadata?: Record<string, unknown>
): void {
  const message = toErrorMessage(error);
  const safeMetadata = sanitizeTelemetryMetadata({
    ...metadata,
    stack: error instanceof Error ? error.stack : undefined,
  });

  if (safeMetadata && Object.keys(safeMetadata).length > 0) {
    console.error(`[${scope}]`, message, safeMetadata);
  } else {
    console.error(`[${scope}]`, message);
  }

  reportClientObservabilityEvent({
    category: "error",
    name: scope,
    status: "error",
    path: typeof window !== "undefined" ? window.location.pathname : undefined,
    errorMessage: message.slice(0, 500),
    metadata: safeMetadata,
  });

  void captureClientException(error, {
    scope,
    path: typeof window !== "undefined" ? window.location.pathname : undefined,
    metadata: safeMetadata,
  });
}
