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

export function mapDbError(message: string, hints: Record<string, string>): string {
  for (const [needle, hint] of Object.entries(hints)) {
    if (message.includes(needle)) return hint;
  }
  return message;
}
