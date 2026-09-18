import { anonymizeClinicalText } from "@/lib/ai/anonymize-clinical-context";

export const DEFAULT_CLINICAL_AI_SANITIZATION_BLOCK_MESSAGE =
  "No se pudo anonimizar completamente el texto antes de enviarlo al proveedor de IA. " +
  "Revise que no incluya DNI, CUIT/CUIL, email, teléfono u otros identificadores directos.";

/** Argentine tax ID: CUIT/CUIL with or without dashes. */
const CUIT_CUIL_RE = /\b(?:20|23|24|27|30|33|34)[\s-]?\d{8}[\s-]?\d\b/gi;
/** DNI with optional dots (12.345.678). */
const DNI_FORMATTED_RE = /\b\d{1,2}\.?\d{3}\.?\d{3}\b/g;
/** Email addresses. */
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
/** Argentine phone numbers (with spaces, dashes, or continuous). */
const PHONE_RE =
  /(?:\+?54[\s-]?)?(?:9[\s-]?)?(?:\d{2,4}[\s-]*)+(?:\d{4}[\s-]?\d{0,4}\d)/g;
/** Street addresses (heuristic: calle/av + number). */
const ADDRESS_RE =
  /\b(?:calle|av\.?|avenida|pasaje|barrio)\s+[a-záéíóúñ0-9\s.,-]{3,40}\d{1,5}\b/gi;
/** Membership / insurance credential numbers (8–16 digits). */
const MEMBERSHIP_RE = /\b(?:afiliado|credencial|nro\.?|n[°º])\s*[:#]?\s*\d{8,16}\b/gi;

const RESIDUAL_PII_PATTERNS = [CUIT_CUIL_RE, DNI_FORMATTED_RE, EMAIL_RE, PHONE_RE] as const;

export { CUIT_CUIL_RE, DNI_FORMATTED_RE, EMAIL_RE, PHONE_RE };

export type SanitizeClinicalAIStatus = "ok" | "partial" | "blocked";

export type SanitizeClinicalAIResult = {
  sanitized: string;
  status: SanitizeClinicalAIStatus;
  redactionCount: number;
  blocked: boolean;
  blockReason?: string;
};

export type SanitizeClinicalAIOptions = {
  /** Known identifiers to redact (patient names, document numbers, etc.). */
  knownIdentifiers?: string[];
  /** When true (default), block if residual PII patterns remain after sanitization. */
  failOnResidualPii?: boolean;
};

function resetGlobalRegex(regex: RegExp): void {
  regex.lastIndex = 0;
}

function countPatternMatches(text: string, patterns: readonly RegExp[]): number {
  let count = 0;
  for (const pattern of patterns) {
    resetGlobalRegex(pattern);
    const matches = text.match(pattern);
    if (matches) count += matches.length;
  }
  return count;
}

function hasResidualPii(text: string): boolean {
  return hasResidualClinicalPii(text);
}

/** Detect whether sanitized text still contains obvious identifier patterns. */
export function hasResidualClinicalPii(text: string): boolean {
  return countPatternMatches(text, RESIDUAL_PII_PATTERNS) > 0;
}

/**
 * Centralized server-side sanitization for all external AI requests.
 * Detects and redacts common Argentine identifiers before data leaves NexClinic.
 */
export function sanitizeClinicalAIInput(
  text: string,
  options: SanitizeClinicalAIOptions = {}
): SanitizeClinicalAIResult {
  const failOnResidualPii = options.failOnResidualPii ?? true;
  const knownIdentifiers = options.knownIdentifiers ?? [];
  let redactionCount = 0;
  let out = text;

  // CUIT/CUIL before generic DNI patterns to avoid partial redaction
  resetGlobalRegex(CUIT_CUIL_RE);
  const cuitMatches = out.match(CUIT_CUIL_RE);
  if (cuitMatches?.length) {
    redactionCount += cuitMatches.length;
    out = out.replace(CUIT_CUIL_RE, "[CUIT/CUIL]");
  }

  const beforeKnown = out;
  out = anonymizeClinicalText(out, knownIdentifiers);
  if (out !== beforeKnown) redactionCount += 1;

  const patterns: Array<[RegExp, string]> = [
    [DNI_FORMATTED_RE, "[DNI]"],
    [EMAIL_RE, "[EMAIL]"],
    [PHONE_RE, "[TEL]"],
    [ADDRESS_RE, "[DIRECCION]"],
    [MEMBERSHIP_RE, "[CREDENCIAL]"],
  ];

  for (const [pattern, replacement] of patterns) {
    resetGlobalRegex(pattern);
    const matches = out.match(pattern);
    if (matches?.length) {
      redactionCount += matches.length;
      out = out.replace(pattern, replacement);
    }
  }

  out = out.replace(/\s{2,}/g, " ").trim();

  if (failOnResidualPii && hasResidualPii(out)) {
    return {
      sanitized: out,
      status: "blocked",
      redactionCount,
      blocked: true,
      blockReason: DEFAULT_CLINICAL_AI_SANITIZATION_BLOCK_MESSAGE,
    };
  }

  const status: SanitizeClinicalAIStatus = redactionCount > 0 ? "partial" : "ok";
  return { sanitized: out, status, redactionCount, blocked: false };
}

/** Sanitize an array of chat messages for external AI providers. */
export function sanitizeClinicalAIChatMessages(
  messages: Array<{ role: string; content: string }>,
  options: SanitizeClinicalAIOptions = {}
): { messages: Array<{ role: string; content: string }>; blocked: boolean; blockReason?: string } {
  const sanitized: Array<{ role: string; content: string }> = [];

  for (const message of messages) {
    const result = sanitizeClinicalAIInput(message.content, options);
    if (result.blocked) {
      return { messages: [], blocked: true, blockReason: result.blockReason };
    }
    sanitized.push({ role: message.role, content: result.sanitized });
  }

  return { messages: sanitized, blocked: false };
}

/** Tokenize patient names in clinic stats context before sending to AI. */
export function anonymizeClinicStatsPatientNames(
  patients: Array<{ name: string; date: string; diagnosis: string | null; coverage: string | null }>
): Array<{ token: string; date: string; diagnosis: string | null; coverage: string | null }> {
  return patients.map((row, index) => ({
    token: `PACIENTE_${String.fromCharCode(65 + (index % 26))}${index >= 26 ? Math.floor(index / 26) : ""}`,
    date: row.date,
    diagnosis: row.diagnosis,
    coverage: row.coverage,
  }));
}
