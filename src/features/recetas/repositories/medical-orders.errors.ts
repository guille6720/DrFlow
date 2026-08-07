/** Internal sentinel: idempotency unique violation (23505) before user-facing formatting. */
export const MEDICAL_ORDER_IDEMPOTENCY_CONFLICT = "__MEDICAL_ORDER_IDEMPOTENCY_CONFLICT__";

/** User-facing errors for concurrent medical order writes. */
export const MEDICAL_ORDER_CONCURRENCY_ERROR =
  "La orden fue modificada por otro usuario. Recargá la página e intentá de nuevo.";

export const MEDICAL_ORDER_VOIDED_ERROR =
  "La orden ya fue anulada por otro usuario.";

export const MEDICAL_ORDER_MISSING_VERSION_ERROR =
  "No se pudo verificar la versión de la orden. Recargá la página e intentá de nuevo.";

export const MEDICAL_ORDER_INVALID_VERSION_ERROR =
  "Versión de orden inválida. Recargá la página e intentá de nuevo.";

export function isMedicalOrderConflictError(message: string): boolean {
  return (
    message === MEDICAL_ORDER_CONCURRENCY_ERROR || message === MEDICAL_ORDER_VOIDED_ERROR
  );
}
