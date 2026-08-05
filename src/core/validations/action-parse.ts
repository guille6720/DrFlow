import type { z } from "zod";

import { firstZodIssue } from "@/core/validations/params";

export type ActionParseError = { error: string };

/** Converts a failed Zod safeParse into a standard action error. */
export function zodActionError(error: z.ZodError): ActionParseError {
  return { error: firstZodIssue(error) };
}

/** Parses input with Zod and returns data or a standard action error. */
export function parseActionInput<T>(
  schema: z.ZodType<T>,
  data: unknown
): { ok: true; data: T } | ActionParseError {
  const parsed = schema.safeParse(data);
  if (!parsed.success) return zodActionError(parsed.error);
  return { ok: true, data: parsed.data };
}
