import { toErrorMessage } from "@/core/errors/error-utils";

/** Client-side diagnostic logging (console.error allowed by eslint). */
export function logClientError(
  scope: string,
  error: unknown,
  metadata?: Record<string, unknown>
): void {
  const message = toErrorMessage(error);
  if (metadata && Object.keys(metadata).length > 0) {
    console.error(`[${scope}]`, message, metadata);
    return;
  }
  console.error(`[${scope}]`, message);
}
