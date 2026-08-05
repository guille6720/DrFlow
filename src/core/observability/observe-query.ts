import "server-only";

import { withObservabilityTiming } from "@/core/observability/record";

/**
 * Times a Supabase/loader query — persists only when slow (≥500 ms) or on error.
 */
export async function observeQuery<T>(
  name: string,
  clinicId: string | null,
  fn: () => Promise<T>,
  path?: string
): Promise<T> {
  return withObservabilityTiming(
    { category: "query", name, clinicId, path, onlyIfSlow: true },
    fn
  );
}
