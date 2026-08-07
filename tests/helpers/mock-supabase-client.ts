import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Adapts a partial Supabase mock for unit tests.
 * Prefer narrow repository/client interfaces in production code when possible.
 */
export function createSupabaseTestDouble(
  mock: Record<string, unknown>
): SupabaseClient {
  return mock as SupabaseClient;
}
