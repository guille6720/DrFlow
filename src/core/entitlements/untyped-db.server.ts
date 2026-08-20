import "server-only";

import type { createClient } from "@/core/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Escape hatch for tables/RPCs added in migrations not yet reflected in
 * generated Database types (e.g. 129_superadmin_commercial_control).
 * Prefer regenerating types after applying the migration on staging.
 */
export function untypedDb(client: SupabaseClient): {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string | number) => {
        maybeSingle: () => Promise<{
          data: Record<string, unknown> | null;
          error: { message: string } | null;
        }>;
        in: (
          column: string,
          values: string[]
        ) => Promise<{
          data: Record<string, unknown>[] | null;
          error: { message: string } | null;
        }>;
      };
      in: (
        column: string,
        values: string[]
      ) => Promise<{
        data: Record<string, unknown>[] | null;
        error: { message: string } | null;
      }>;
    };
  };
  rpc: (
    fn: string,
    args?: Record<string, unknown>
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
} {
  return client as never;
}
