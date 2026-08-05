import type { SupabaseClient } from "@supabase/supabase-js";

/** Call RPC; return fallback when function is not yet deployed. */
export async function rpcScalarWithFallback<T>(
  supabase: SupabaseClient,
  rpcName: string,
  args: Record<string, unknown>,
  fallback: () => Promise<T>
): Promise<T> {
  const { data, error } = await supabase.rpc(rpcName, args);
  if (!error && data != null) return data as T;
  return fallback();
}
