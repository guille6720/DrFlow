import type { ZodError } from "zod";

export function zodFieldErrors(error: ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0]?.toString();
    if (key && !fields[key]) {
      fields[key] = issue.message;
    }
  }
  return fields;
}

export function firstFieldError(fields: Record<string, string>): string | undefined {
  return Object.values(fields)[0];
}

export function normalizeSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-");
}
