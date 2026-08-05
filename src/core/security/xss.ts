/**
 * XSS helpers — sanitize text for display and URLs for href attributes.
 * React escapes text nodes; these guards cover href/src and legacy DOM APIs.
 */

const DISPLAY_TEXT_MAX = 500;

/** Strip control chars and HTML tags for reflected / dynamic UI messages. */
export function sanitizeDisplayText(input: string, maxLen = DISPLAY_TEXT_MAX): string {
  return input
    .replace(/\0/g, "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/javascript:/gi, "")
    .replace(/data:text\/html/gi, "")
    .trim()
    .slice(0, maxLen);
}

/** Escape HTML entities for safe insertion into document.write / static templates. */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Allow only same-origin relative paths in Link href. */
export function sanitizeInternalPath(path: string | null | undefined): string | null {
  if (!path?.trim()) return null;
  const p = path.trim();
  if (!p.startsWith("/") || p.startsWith("//") || p.includes("\\")) return null;
  if (/^(javascript|data|vbscript):/i.test(p)) return null;
  if (p.length > 2048) return null;
  return p;
}

const ALLOWED_EXTERNAL_PROTOCOLS = new Set(["http:", "https:"]);

/** Allow http(s) external URLs only — blocks javascript:, data:, etc. */
export function sanitizeExternalUrl(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  try {
    const parsed = new URL(url.trim());
    if (!ALLOWED_EXTERNAL_PROTOCOLS.has(parsed.protocol)) return null;
    return parsed.href;
  } catch {
    return null;
  }
}

/** Known OAuth / auth error tokens mapped to safe user messages. */
const AUTH_ERROR_MESSAGES: Record<string, string> = {
  access_denied: "El link de recuperación expiró o no es válido. Pedí uno nuevo abajo.",
  "access denied": "El link de recuperación expiró o no es válido. Pedí uno nuevo abajo.",
};

/** Sanitize error text from URL query params (login/OAuth callbacks). */
export function sanitizeAuthErrorParam(raw: string | null): string | null {
  if (!raw?.trim()) return null;
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    decoded = raw;
  }
  const normalized = decoded.trim().toLowerCase();
  if (AUTH_ERROR_MESSAGES[normalized]) return AUTH_ERROR_MESSAGES[normalized];
  if (normalized.includes("access_denied") || normalized.includes("access denied")) {
    return AUTH_ERROR_MESSAGES["access_denied"];
  }
  return sanitizeDisplayText(decoded);
}
