import "server-only";

import type { CriticalOperation } from "@/core/observability/operation-thresholds";
import { withObservabilityTiming } from "@/core/observability/record";
import { getRequestTraceId } from "@/core/observability/request-trace";

/** Time a critical user-facing operation and persist duration to observability events. */
export async function observeCriticalOperation<T>(
  operation: CriticalOperation,
  input: { clinicId?: string | null; path?: string },
  fn: () => Promise<T>
): Promise<T> {
  const traceId = await getRequestTraceId();
  return withObservabilityTiming(
    {
      clinicId: input.clinicId,
      category: "performance",
      name: operation,
      path: input.path,
      traceId,
      onlyIfSlow: false,
      metadata: { operation },
    },
    fn
  );
}
