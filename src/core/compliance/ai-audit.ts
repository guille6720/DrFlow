import "server-only";

import { recordAudit, type RecordAuditParams } from "@/core/security/audit-service";

export type AiAuditFeature =
  | "clinical_ai_api"
  | "gemini_clinical_chat"
  | "clinical_ai_byok"
  | "clinical_ai_job"
  | "admin_ops_ai";

export type AiAuditProvider =
  | "vertex_gemini"
  | "gemini_api"
  | "gemini"
  | "openai"
  | "anthropic"
  | "openai_compatible"
  | "rule_based"
  | "unknown";

export type AiSanitizationStatus = "ok" | "partial" | "blocked" | "not_applicable";

export const AI_AUDIT_ERROR_CODES = {
  SANITIZATION_BLOCKED: "sanitization_blocked",
  NO_MODEL_RESPONSE: "no_model_response",
  PROVIDER_ERROR: "provider_error",
} as const;

export type AiAuditErrorCode = (typeof AI_AUDIT_ERROR_CODES)[keyof typeof AI_AUDIT_ERROR_CODES];

/** Metadata keys allowed in immutable audit_logs for AI events (no PHI / prompts). */
export const AI_AUDIT_METADATA_ALLOWLIST = [
  "provider",
  "model",
  "task",
  "success",
  "sanitization_status",
  "redaction_count",
  "error_code",
  "duration_ms",
] as const;

const ALLOWED_METADATA_KEYS = new Set<string>(AI_AUDIT_METADATA_ALLOWLIST);

export type RecordAiAuditEventParams = {
  clinicId: string;
  userId?: string;
  patientId?: string;
  feature: AiAuditFeature;
  provider: AiAuditProvider;
  model?: string;
  task?: string;
  success: boolean;
  sanitizationStatus: AiSanitizationStatus;
  redactionCount?: number;
  errorCode?: string;
  durationMs?: number;
};

/**
 * Build privacy-safe metadata for AI audit rows.
 * Allowlist-only — strips prompt/response/content and any unknown keys.
 */
export function buildAiAuditMetadata(params: RecordAiAuditEventParams): Record<string, unknown> {
  const candidate: Record<string, unknown> = {
    provider: params.provider,
    model: params.model ?? null,
    task: params.task ?? null,
    success: params.success,
    sanitization_status: params.sanitizationStatus,
    redaction_count: params.redactionCount ?? 0,
    error_code: params.errorCode ?? null,
    duration_ms: params.durationMs ?? null,
  };

  return sanitizeAiAuditMetadata(candidate);
}

/** Remove keys outside the AI audit allowlist (defense in depth). */
export function sanitizeAiAuditMetadata(
  metadata: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (!ALLOWED_METADATA_KEYS.has(key)) continue;
    if (value === undefined) continue;
    out[key] = value;
  }
  return out;
}

/** Maps AI audit params to immutable `audit_logs` insert payload (testable without DB). */
export function buildAiAuditRecordParams(params: RecordAiAuditEventParams): RecordAuditParams {
  return {
    clinicId: params.clinicId,
    userId: params.userId,
    patientId: params.patientId,
    module: "ia",
    entityType: "ai_request",
    entityId: params.feature,
    action: "create",
    what: `ai.${params.feature}`,
    metadata: buildAiAuditMetadata(params),
  };
}

/**
 * Privacy-safe AI audit events.
 * Does NOT store prompts, responses, or clinical content.
 */
export async function recordAiAuditEvent(params: RecordAiAuditEventParams): Promise<void> {
  await recordAudit(buildAiAuditRecordParams(params));
}
