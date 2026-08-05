/** Normalize unknown thrown values into a human-readable message. */
export function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error == null) return "Unknown error";
  if (error && typeof error === "object" && "message" in error) {
    const msg = (error as { message?: unknown }).message;
    if (typeof msg === "string" && msg.trim()) return msg;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return "Unknown error";
  }
}

/** Coerce unknown values into an Error instance. */
export function toError(error: unknown): Error {
  if (error instanceof Error) return error;
  return new Error(toErrorMessage(error));
}

/** Supabase/PostgREST style errors with a message field. */
export function toPostgrestErrorMessage(error: { message?: string } | null | undefined): string | undefined {
  return error?.message?.trim() || undefined;
}
