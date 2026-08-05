import "server-only";

import { logServerError } from "@/core/errors/log-error.server";

export type ActionErrorBoundaryOptions = {
  clinicId?: string | null;
  getFileName?: () => string;
  metadata?: Record<string, unknown>;
};

/**
 * Wraps a server action body: logs unexpected failures and returns a safe fallback.
 * Preserves existing user-facing error messages.
 */
export async function withActionErrorBoundary<T>(
  scope: string,
  fallback: (fileName: string) => T,
  fn: () => Promise<T>,
  options?: ActionErrorBoundaryOptions
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    logServerError(scope, error, {
      clinicId: options?.clinicId,
      metadata: {
        ...options?.metadata,
        fileName: options?.getFileName?.(),
      },
    });
    return fallback(options?.getFileName?.() ?? "");
  }
}
