import { isUniqueViolation } from "@/core/errors/postgres-error";

import { MEDICAL_ORDER_IDEMPOTENCY_CONFLICT } from "@/features/recetas/repositories/medical-orders.errors";

/** Generates a client idempotency key for medical order creation. */
export function createMedicalOrderIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export function isMedicalOrderUniqueViolation(
  error: string | { code?: string | null; message?: string | null }
): boolean {
  if (typeof error === "string") {
    return error === MEDICAL_ORDER_IDEMPOTENCY_CONFLICT;
  }
  return isUniqueViolation(error);
}