import "server-only";

import { userFacingErrorMessage } from "@/core/observability/correlation-id";

export type SafeUserError = {
  message: string;
  reference: string | null;
};

/** Safe user-facing error — no stack traces or internal details. */
export function toSafeUserError(
  baseMessage: string,
  traceId?: string | null
): SafeUserError {
  const message = userFacingErrorMessage(baseMessage, traceId);
  const refMatch = message.match(/Referencia: (DF-[A-F0-9]{6})/);
  return {
    message,
    reference: refMatch?.[1] ?? null,
  };
}
