import type { SanitizeClinicalAIOptions, SanitizeClinicalAIResult } from "@/lib/ai/sanitize-clinical-ai-input";
import {
  DEFAULT_CLINICAL_AI_SANITIZATION_BLOCK_MESSAGE,
  sanitizeClinicalAIInput,
} from "@/lib/ai/sanitize-clinical-ai-input";

/** Stable API / audit code when sanitization blocks an external AI request. */
export const CLINICAL_AI_SANITIZATION_BLOCKED_CODE = "sanitization_blocked" as const;

export { DEFAULT_CLINICAL_AI_SANITIZATION_BLOCK_MESSAGE };

export class ClinicalAiSanitizationError extends Error {
  readonly sanitizationResult?: SanitizeClinicalAIResult;

  constructor(message: string, sanitizationResult?: SanitizeClinicalAIResult) {
    super(message);
    this.name = "ClinicalAiSanitizationError";
    this.sanitizationResult = sanitizationResult;
  }
}

export type ClinicalAiSanitizationFailure = {
  code: typeof CLINICAL_AI_SANITIZATION_BLOCKED_CODE;
  error: string;
};

/** JSON body for controlled API errors when fail-safe blocks an AI request. */
export function clinicalAiSanitizationFailureResponse(
  error: ClinicalAiSanitizationError | SanitizeClinicalAIResult | string
): ClinicalAiSanitizationFailure {
  const message =
    typeof error === "string"
      ? error
      : error instanceof ClinicalAiSanitizationError
        ? error.message
        : (error.blockReason ?? DEFAULT_CLINICAL_AI_SANITIZATION_BLOCK_MESSAGE);

  return {
    code: CLINICAL_AI_SANITIZATION_BLOCKED_CODE,
    error: message,
  };
}

/**
 * Fail-safe gate: throws if text cannot be safely sent to an external AI provider.
 * Never call external AI HTTP helpers without passing through this or the gateway.
 */
export function assertSafeForExternalClinicalAi(
  text: string,
  options: SanitizeClinicalAIOptions = {}
): SanitizeClinicalAIResult {
  const result = sanitizeClinicalAIInput(text, options);
  if (result.blocked) {
    throw new ClinicalAiSanitizationError(
      result.blockReason ?? DEFAULT_CLINICAL_AI_SANITIZATION_BLOCK_MESSAGE,
      result
    );
  }
  return result;
}

/** Returns true when outbound text still matches residual identifier patterns. */
export function shouldBlockClinicalAiOutbound(
  text: string,
  options: SanitizeClinicalAIOptions = {}
): boolean {
  return sanitizeClinicalAIInput(text, options).blocked;
}
