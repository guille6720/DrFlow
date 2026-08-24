/**
 * Phase 15 — Application security posture (headers, CSRF, XSS, auth hardening).
 * Not legal advice.
 */

import {
  AUTH_LOGIN_RATE_LIMIT,
  AUTH_RESET_RATE_LIMIT,
} from "@/core/security/rate-limit";
import { SECURITY_RESPONSE_HEADERS } from "@/core/security/response-headers";

export const SECURE_SESSION_COOKIE_POLICY = {
  httpOnly: true,
  secureInProduction: true,
  sameSite: "lax" as const,
} as const;

export type ApplicationSecurityRequirement = {
  id: string;
  label: string;
  signals: string[];
};

export const APPLICATION_SECURITY_REQUIREMENTS: ApplicationSecurityRequirement[] = [
  {
    id: "security_headers",
    label: "CSP, HSTS, frame-ancestors, Referrer-Policy, Permissions-Policy",
    signals: [
      "SECURITY_RESPONSE_HEADERS",
      "Content-Security-Policy",
      "Strict-Transport-Security",
      "frame-ancestors",
      "Permissions-Policy",
      "Cross-Origin-Opener-Policy",
    ],
  },
  {
    id: "csrf",
    label: "Mutaciones same-origin (Origin/Referer vs Host)",
    signals: ["requireSameOriginMutation", "isSameOriginRequest", "isSameOriginPost"],
  },
  {
    id: "secure_cookies",
    label: "Cookies de sesión httpOnly + secure (prod) + SameSite",
    signals: ["httpOnly: true", "sameSite: \"lax\"", "DEVICE_SESSION_COOKIE"],
  },
  {
    id: "open_redirect",
    label: "Redirects internos validados",
    signals: ["safeRedirectPathSchema", "parseSafeRedirectPath"],
  },
  {
    id: "xss",
    label: "Sanitización de texto/URL para UI",
    signals: ["sanitizeDisplayText", "sanitizeInternalPath", "sanitizeExternalUrl", "escapeHtml"],
  },
  {
    id: "sql_injection",
    label: "Consultas parametrizadas + RLS (sin SQL dinámico de usuario)",
    signals: [".from(", ".eq(", "RLS", "zod", "parseEntityId"],
  },
  {
    id: "ssrf",
    label: "Fetch saliente acotado a hosts permitidos",
    signals: ["isSafeOutboundUrl", "assertSafeOutboundUrl"],
  },
  {
    id: "file_upload",
    label: "Validación de contenido/MIME en uploads",
    signals: ["validatePdfUpload", "validateAdminDocumentUpload", "isPdfBuffer", "sanitizeStorageFileName"],
  },
  {
    id: "rate_limit",
    label: "Rate limiting en auth y API pública",
    signals: ["checkRateLimit", "checkPublicApiRateLimit", "AUTH_LOGIN_RATE_LIMIT"],
  },
  {
    id: "brute_force",
    label: "Throttling de login / reset password",
    signals: ["AUTH_LOGIN_RATE_LIMIT", "AUTH_RESET_RATE_LIMIT", "getRequestClientIp"],
  },
];

export type ApplicationSecuritySurface = {
  id: string;
  label: string;
  control: string;
};

export const APPLICATION_SECURITY_SURFACES: ApplicationSecuritySurface[] = [
  { id: "auth_login", label: "POST /api/auth/login", control: "CSRF + rate limit + Supabase auth" },
  { id: "auth_reset", label: "POST /api/auth/reset-password", control: "CSRF + rate limit" },
  { id: "auth_bootstrap", label: "POST /api/auth/bootstrap", control: "CSRF" },
  { id: "billing_checkout", label: "POST /api/billing/create-preference", control: "CSRF + session + settings ACL" },
  { id: "clinical_ai", label: "POST /api/clinical-ai", control: "CSRF + tenant + patient scope" },
  { id: "public_api", label: "API v1", control: "API key + rate limit + tenant RPC gate" },
  { id: "cron_jobs", label: "Cron /api/jobs/*", control: "authorizeCronRequest (secret)" },
  { id: "file_uploads", label: "Adjuntos / imports", control: "Magic-byte validation + storage RLS" },
];

export type ApplicationSecurityPosture = {
  headerCount: number;
  requirementCount: number;
  authLoginLimit: RateLimitSummary;
  authResetLimit: RateLimitSummary;
  notes: string[];
};

type RateLimitSummary = {
  windowMinutes: number;
  maxRequests: number;
};

export function evaluateApplicationSecurityPosture(): ApplicationSecurityPosture {
  return {
    headerCount: SECURITY_RESPONSE_HEADERS.length,
    requirementCount: APPLICATION_SECURITY_REQUIREMENTS.length,
    authLoginLimit: {
      windowMinutes: AUTH_LOGIN_RATE_LIMIT.windowMs / 60_000,
      maxRequests: AUTH_LOGIN_RATE_LIMIT.maxRequests,
    },
    authResetLimit: {
      windowMinutes: AUTH_RESET_RATE_LIMIT.windowMs / 60_000,
      maxRequests: AUTH_RESET_RATE_LIMIT.maxRequests,
    },
    notes: [
      "Headers OWASP aplicados vía next.config y vercel.json.",
      "Mutaciones de sesión validan same-origin; webhooks/cron usan secretos dedicados.",
      "Redirects post-auth usan rutas relativas validadas (sin //evil.com).",
      "Uploads validan magic bytes; SQL vía Supabase client + RLS.",
      "Rate limit in-memory complementa límites de Supabase Auth.",
    ],
  };
}
