import { isUniqueViolation } from "@/core/errors/postgres-error";

export const PRESCRIPTION_IDEMPOTENCY_CONFLICT =
  "Ya existe una receta emitida con esta clave de idempotencia.";

/** Generates a client idempotency key for prescription issue. */
export function createPrescriptionIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export function isPrescriptionUniqueViolation(
  error: string | { code?: string | null; message?: string | null }
): boolean {
  if (typeof error === "string") {
    return error === PRESCRIPTION_IDEMPOTENCY_CONFLICT;
  }
  return isUniqueViolation(error);
}
