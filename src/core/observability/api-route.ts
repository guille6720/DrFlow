import "server-only";

import { createTraceId, recordObservabilityEvent } from "@/core/observability/record";
import { SLOW_REQUEST_MS } from "@/core/observability/types";

export type ObservabilityApiContext = {
  path: string;
  traceId: string;
  clinicId?: string | null;
};

type ApiHandler = (request: Request, ctx: ObservabilityApiContext) => Promise<Response>;

/**
 * Wraps an API route handler with non-blocking timing (only persists slow/error).
 */
export function withObservabilityApiRoute(name: string, handler: ApiHandler) {
  return async (request: Request): Promise<Response> => {
    const start = performance.now();
    const path = new URL(request.url).pathname;
    const traceId = request.headers.get("x-drflow-trace-id") ?? createTraceId();
    const ctx: ObservabilityApiContext = { path, traceId };

    try {
      const response = await handler(request, ctx);
      const durationMs = Math.round(performance.now() - start);

      if (durationMs >= SLOW_REQUEST_MS) {
        void recordObservabilityEvent({
          clinicId: ctx.clinicId ?? null,
          category: "api",
          name,
          path,
          traceId,
          durationMs,
          status: durationMs >= SLOW_REQUEST_MS * 2 ? "error" : "warn",
        });
      }

      return response;
    } catch (err) {
      const durationMs = Math.round(performance.now() - start);
      void recordObservabilityEvent({
        clinicId: ctx.clinicId ?? null,
        category: "api",
        name,
        path,
        traceId,
        durationMs,
        status: "error",
        errorMessage: err instanceof Error ? err.message : "Unknown error",
      });
      throw err;
    }
  };
}
