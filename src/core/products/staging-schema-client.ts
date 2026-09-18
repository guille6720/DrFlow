import "server-only";

/**
 * Minimal query surface for geriatrics tables / product RPCs until
 * `npm run supabase:types` is regenerated from staging (migrations 158–159).
 */
export type StagingQueryResult<T = Record<string, unknown>> = {
  data: T[] | null;
  error: { message: string; code?: string } | null;
  count: number | null;
};

export type StagingFilterBuilder<T = Record<string, unknown>> = PromiseLike<StagingQueryResult<T>> & {
  eq: (column: string, value: unknown) => StagingFilterBuilder<T>;
  in: (column: string, values: readonly string[]) => StagingFilterBuilder<T>;
  gte: (column: string, value: unknown) => StagingFilterBuilder<T>;
  lt: (column: string, value: unknown) => StagingFilterBuilder<T>;
  order: (column: string, options?: { ascending?: boolean }) => StagingFilterBuilder<T>;
  maybeSingle: () => PromiseLike<{ data: T | null; error: { message: string; code?: string } | null }>;
  single: () => PromiseLike<{ data: T | null; error: { message: string; code?: string } | null }>;
};

export type StagingInsertBuilder<T = Record<string, unknown>> = {
  select: (columns: string) => {
    single: () => PromiseLike<{ data: T | null; error: { message: string; code?: string } | null }>;
  };
} & PromiseLike<{ error: { message: string; code?: string } | null }>;

export type StagingUpdateBuilder = {
  eq: (column: string, value: unknown) => StagingUpdateBuilder;
} & PromiseLike<{ error: { message: string; code?: string } | null }>;

export type StagingTable = {
  select: (
    columns: string,
    options?: { count?: "exact"; head?: boolean }
  ) => StagingFilterBuilder;
  insert: (row: Record<string, unknown> | Record<string, unknown>[]) => StagingInsertBuilder;
  update: (row: Record<string, unknown>) => StagingUpdateBuilder;
};

export type StagingSchemaClient = {
  from: (table: string) => StagingTable;
  rpc: (
    fn: string,
    args: Record<string, unknown>
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

export function asStagingSchemaClient(client: unknown): StagingSchemaClient {
  return client as StagingSchemaClient;
}
