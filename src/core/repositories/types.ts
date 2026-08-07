import type { SupabaseClient } from "@supabase/supabase-js";

/** Supabase client passed into repositories (server or service role). */
export type DbClient = SupabaseClient;

export type RepoResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export function repoOk<T>(data: T): RepoResult<T> {
  return { ok: true, data };
}

export function repoErr<T = never>(error: string): RepoResult<T> {
  return { ok: false, error };
}

import type { PostgresErrorLike } from "@/core/errors/postgres-error";
import { resolveRepositoryDbError } from "@/core/errors/postgres-error";

/** @deprecated Prefer resolveRepositoryDbError(error) with a PostgresErrorLike object. */
export function mapDbError(message: string, hints: Record<string, string>): string {
  return resolveRepositoryDbError({ message }, hints);
}

export function mapPostgresError(
  error: PostgresErrorLike,
  extraColumnHints: Record<string, string> = {}
): string {
  return resolveRepositoryDbError(error, extraColumnHints);
}
