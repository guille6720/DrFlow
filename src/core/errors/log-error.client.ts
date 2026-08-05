import { toErrorMessage } from "@/core/errors/error-utils";
import { reportClientObservabilityEvent } from "@/core/observability/client-reporter";

/** Client-side diagnostic logging (console.error allowed by eslint). */
export function logClientError(
  scope: string,
  error: unknown,
  metadata?: Record<string, unknown>
): void {
  const message = toErrorMessage(error);
  if (metadata && Object.keys(metadata).length > 0) {
    console.error(`[${scope}]`, message, metadata);
  } else {
    console.error(`[${scope}]`, message);
  }

  reportClientObservabilityEvent({
    category: "error",
    name: scope,
    status: "error",
    path: typeof window !== "undefined" ? window.location.pathname : undefined,
    errorMessage: message,
    metadata: {
      ...metadata,
      stack: error instanceof Error ? error.stack : undefined,
    },
  });
}
