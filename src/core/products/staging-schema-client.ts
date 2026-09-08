import "server-only";

/**
 * Minimal query surface for geriatrics tables / product RPCs until
 * `npm run supabase:types` is regenerated from staging (migrations 158–159).
 */
export type StagingQueryResult<T = Record<string, unknown>> = {
  data: T[] | null;
  error: { message: string } | null;
  count: number | null;
};

export type StagingFilterBuilder<T = Record<string, unknown>> = PromiseLike<StagingQueryResult<T>> & {
  eq: (column: string, value: unknown) => StagingFilterBuilder<T>;
  gte: (column: string, value: unknown) => StagingFilterBuilder<T>;
  lt: (column: string, value: unknown) => StagingFilterBuilder<T>;
  order: (column: string, options?: { ascending?: boolean }) => StagingFilterBuilder<T>;
};

export type StagingSchemaClient = {
  from: (table: string) => {
    select: (
      columns: string,
      options?: { count?: "exact"; head?: boolean }
    ) => StagingFilterBuilder;
  };
  rpc: (
    fn: string,
    args: Record<string, unknown>
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

export function asStagingSchemaClient(client: unknown): StagingSchemaClient {
  return client as StagingSchemaClient;
}
