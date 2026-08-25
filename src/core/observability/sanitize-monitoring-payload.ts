/**
 * Sanitize operational / monitoring payloads — never ship PHI or secrets.
 */

const BLOCKED_KEY_PATTERN =
  /(password|secret|token|authorization|api[_-]?key|service[_-]?role|otp|totp|cuil|dni|document_number|diagnosis|medication|posology|notes|medical_history|allergies)/i;

const BLOCKED_VALUE_PATTERN =
  /(eyJ[a-zA-Z0-9_-]{10,}\.|Bearer\s+[A-Za-z0-9._-]+|postgres(ql)?:\/\/)/i;

export function sanitizeMonitoringPayload(
  input: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (BLOCKED_KEY_PATTERN.test(key)) {
      out[key] = "[redacted]";
      continue;
    }
    if (typeof value === "string") {
      out[key] = BLOCKED_VALUE_PATTERN.test(value) ? "[redacted]" : value.slice(0, 200);
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
            ? item.slice(0, 200)
            : item
      );
      continue;
    }
    out[key] = value;
  }
  return out;
}
