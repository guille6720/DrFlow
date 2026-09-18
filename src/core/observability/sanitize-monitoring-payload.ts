/**
 * Sanitize operational / monitoring payloads — never ship PHI or secrets.
 * Used by observability events, structured logs, and Sentry context.
 */

const BLOCKED_KEY_PATTERN =
  /(password|secret|token|authorization|api[_-]?key|service[_-]?role|otp|totp|cuil|dni|document_number|diagnosis|medication|posology|notes|medical_history|allergies|chief_complaint|evolution|indications|prescription|soap|first_name|last_name|full_name|email|phone|address|birth_date|patient_name|raw_body|request_body|row_payload|medications|evolution_text|diagnosis_text)/i;

const BLOCKED_VALUE_PATTERN =
  /(eyJ[a-zA-Z0-9_-]{10,}\.|Bearer\s+[A-Za-z0-9._-]+|postgres(ql)?:\/\/|@staging\.|@example\.|@[a-z0-9.-]+\.(com|ar|invalid))/i;

const CLINICAL_TEXT_PATTERN =
  /\b(SOAP|Dx:|Rx:|consulta|paciente|diagnóstico|receta|evolución)\b/i;

export function redactStringValue(value: string, maxLen = 200): string {
  if (BLOCKED_VALUE_PATTERN.test(value)) return "[redacted]";
  if (value.length > maxLen && CLINICAL_TEXT_PATTERN.test(value)) return "[redacted]";
  return value.slice(0, maxLen);
}

export function sanitizeMonitoringPayload(
  input: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (BLOCKED_KEY_PATTERN.test(key)) {
      out[key] = "[redacted]";
      continue;
    }
    if (key === "stack" && typeof value === "string") {
      out[key] = value.split("\n").slice(0, 8).join("\n").slice(0, 1200);
      continue;
    }
    if (typeof value === "string") {
      out[key] = redactStringValue(value);
      continue;
    }
    if (value && typeof value === "object" && !Array.isArray(value)) {
      out[key] = sanitizeMonitoringPayload(value as Record<string, unknown>);
      continue;
    }
    if (Array.isArray(value)) {
      out[key] = value.slice(0, 20).map((item) =>
        item && typeof item === "object"
          ? sanitizeMonitoringPayload(item as Record<string, unknown>)
          : typeof item === "string"
            ? redactStringValue(item)
            : item
      );
      continue;
    }
    out[key] = value;
  }
  return out;
}

/** Sanitize arbitrary metadata before Sentry / external telemetry. */
export function sanitizeTelemetryMetadata(
  metadata?: Record<string, unknown> | null
): Record<string, unknown> | undefined {
  if (!metadata || Object.keys(metadata).length === 0) return undefined;
  return sanitizeMonitoringPayload(metadata);
}

/** Strip PHI-like keys from Sentry event extras (beforeSend). Mutates in place. */
export function sanitizeSentryEventInPlace(event: {
  extra?: Record<string, unknown>;
  contexts?: Record<string, unknown>;
}): void {
  if (event.extra) {
    event.extra = sanitizeMonitoringPayload(event.extra);
  }
  if (event.contexts) {
    for (const [key, ctx] of Object.entries(event.contexts)) {
      if (ctx && typeof ctx === "object") {
        event.contexts[key] = sanitizeMonitoringPayload(ctx as Record<string, unknown>);
      }
    }
  }
}
