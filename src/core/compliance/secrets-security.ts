/**
 * Phase 16 — Secrets management posture (no literals in repo, env-only, server-only).
 * Not legal advice. Never log or report full secret values.
 */

export type SecretCredentialClass =
  | "supabase_service_role"
  | "supabase_publishable"
  | "database_url"
  | "cron_secret"
  | "mercado_pago"
  | "google_vertex_gemini"
  | "openai_clinical_ai"
  | "smtp_resend"
  | "whatsapp"
  | "daily_telemedicine"
  | "refeps"
  | "sentry"
  | "vercel_oidc"
  | "private_certificate"
  | "jwt_session";

export type SecretCredentialDefinition = {
  class: SecretCredentialClass;
  label: string;
  envVars: string[];
  serverOnly: boolean;
  /** When leaked in git/docs, operator should rotate this class. */
  rotationRequiredOnLeak: boolean;
};

export const SECRET_CREDENTIAL_CATALOG: SecretCredentialDefinition[] = [
  {
    class: "supabase_service_role",
    label: "Supabase service_role (bypass RLS)",
    envVars: ["SUPABASE_SERVICE_ROLE_KEY"],
    serverOnly: true,
    rotationRequiredOnLeak: true,
  },
  {
    class: "supabase_publishable",
    label: "Supabase publishable / anon key",
    envVars: ["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY"],
    serverOnly: false,
    rotationRequiredOnLeak: true,
  },
  {
    class: "database_url",
    label: "Postgres connection string",
    envVars: ["DATABASE_URL"],
    serverOnly: true,
    rotationRequiredOnLeak: true,
  },
  {
    class: "cron_secret",
    label: "Cron / worker bearer secret",
    envVars: ["CRON_SECRET"],
    serverOnly: true,
    rotationRequiredOnLeak: true,
  },
  {
    class: "mercado_pago",
    label: "Mercado Pago access + webhook",
    envVars: [
      "MP_ACCESS_TOKEN",
      "MERCADOPAGO_ACCESS_TOKEN",
      "MP_WEBHOOK_SECRET",
      "MERCADOPAGO_WEBHOOK_SECRET",
    ],
    serverOnly: true,
    rotationRequiredOnLeak: true,
  },
  {
    class: "google_vertex_gemini",
    label: "Google Vertex / Gemini credentials",
    envVars: [
      "VERTEX_AI_SERVICE_ACCOUNT_JSON",
      "GOOGLE_SERVICE_ACCOUNT_JSON",
      "GEMINI_API_KEY",
      "GOOGLE_GENERATIVE_AI_API_KEY",
    ],
    serverOnly: true,
    rotationRequiredOnLeak: true,
  },
  {
    class: "openai_clinical_ai",
    label: "Clinical AI LLM (OpenAI-compatible)",
    envVars: ["CLINICAL_AI_LLM_API_KEY", "OPENAI_API_KEY"],
    serverOnly: true,
    rotationRequiredOnLeak: true,
  },
  {
    class: "smtp_resend",
    label: "Transactional email",
    envVars: ["RESEND_API_KEY", "SMTP_PASSWORD", "SMTP_PASS"],
    serverOnly: true,
    rotationRequiredOnLeak: true,
  },
  {
    class: "whatsapp",
    label: "WhatsApp Cloud API",
    envVars: ["WHATSAPP_ACCESS_TOKEN"],
    serverOnly: true,
    rotationRequiredOnLeak: true,
  },
  {
    class: "daily_telemedicine",
    label: "Daily.co telemedicine",
    envVars: ["DAILY_API_KEY"],
    serverOnly: true,
    rotationRequiredOnLeak: true,
  },
  {
    class: "refeps",
    label: "REFEPS adapter",
    envVars: ["REFEPS_API_KEY"],
    serverOnly: true,
    rotationRequiredOnLeak: true,
  },
  {
    class: "sentry",
    label: "Sentry DSN",
    envVars: ["SENTRY_DSN", "NEXT_PUBLIC_SENTRY_DSN"],
    serverOnly: false,
    rotationRequiredOnLeak: false,
  },
  {
    class: "vercel_oidc",
    label: "Vercel OIDC (local CLI tooling)",
    envVars: ["VERCEL_OIDC_TOKEN"],
    serverOnly: true,
    rotationRequiredOnLeak: true,
  },
  {
    class: "private_certificate",
    label: "TLS / signing PEM material",
    envVars: [],
    serverOnly: true,
    rotationRequiredOnLeak: true,
  },
  {
    class: "jwt_session",
    label: "JWT literals (non-placeholder)",
    envVars: [],
    serverOnly: true,
    rotationRequiredOnLeak: true,
  },
];

/** Static scan patterns — labels only; never echo capture groups in reports. */
export const SECRET_LEAK_SCAN_PATTERNS: ReadonlyArray<{
  id: string;
  label: string;
  credentialClass: SecretCredentialClass;
  pattern: RegExp;
}> = [
  {
    id: "hardcoded_service_role",
    label: "SUPABASE_SERVICE_ROLE_KEY literal",
    credentialClass: "supabase_service_role",
    pattern: /SUPABASE_SERVICE_ROLE_KEY\s*=\s*["']?(?:eyJ|sb_secret_)[^\s"'`;]{10,}/,
  },
  {
    id: "hardcoded_cron",
    label: "CRON_SECRET literal",
    credentialClass: "cron_secret",
    pattern: /CRON_SECRET\s*=\s*["'][^"']{8,}["']/,
  },
  {
    id: "hardcoded_mp",
    label: "Mercado Pago token literal",
    credentialClass: "mercado_pago",
    pattern: /(?:MP_ACCESS_TOKEN|MERCADOPAGO_ACCESS_TOKEN)\s*=\s*["'][^"']{8,}["']/,
  },
  {
    id: "hardcoded_openai",
    label: "OpenAI / clinical AI key literal",
    credentialClass: "openai_clinical_ai",
    pattern: /(?:OPENAI_API_KEY|CLINICAL_AI_LLM_API_KEY)\s*=\s*["'][^"']{8,}["']/,
  },
  {
    id: "hardcoded_gemini",
    label: "Gemini API key literal",
    credentialClass: "google_vertex_gemini",
    pattern: /(?:GEMINI_API_KEY|GOOGLE_GENERATIVE_AI_API_KEY)\s*=\s*["'][^"']{8,}["']/,
  },
  {
    id: "jwt_literal",
    label: "JWT token literal",
    credentialClass: "jwt_session",
    pattern: /eyJ[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{10,}/,
  },
  {
    id: "private_pem",
    label: "PEM private key block",
    credentialClass: "private_certificate",
    pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  },
  {
    id: "database_url_password",
    label: "DATABASE_URL with embedded password",
    credentialClass: "database_url",
    pattern: /postgresql:\/\/[^:]+:(?!TU_PASSWORD|YOUR_PASSWORD|\[password\]|\.\.\.)[^@\s]{6,}@/i,
  },
];

export const SERVER_ONLY_SECRET_MODULES = [
  "src/core/supabase/admin.ts",
  "src/core/env.server.ts",
  "src/core/billing/mercadopago.ts",
  "src/lib/utils/clinical-ai-llm-provider.server.ts",
  "src/lib/ai/vertex-gemini.server.ts",
  "src/lib/ai/vertex-gemini-config.ts",
  "src/lib/ai/run-gemini-clinical.server.ts",
  "src/lib/services/transactional-email.ts",
  "src/core/whatsapp/provider.ts",
  "src/core/telemedicine/provider.ts",
  "src/core/refeps/provider.ts",
] as const;

export type SecretLeakFinding = {
  file: string;
  patternId: string;
  credentialClass: SecretCredentialClass;
};

export function scanContentForSecretLeaks(
  content: string,
  file: string,
  options?: { allowJwtPlaceholder?: boolean }
): SecretLeakFinding[] {
  const findings: SecretLeakFinding[] = [];
  for (const rule of SECRET_LEAK_SCAN_PATTERNS) {
    if (options?.allowJwtPlaceholder && rule.id === "jwt_literal" && content.includes("eyJhbG...")) {
      continue;
    }
    if (rule.pattern.test(content)) {
      findings.push({
        file,
        patternId: rule.id,
        credentialClass: rule.credentialClass,
      });
    }
    rule.pattern.lastIndex = 0;
  }
  return findings;
}

export type SecretsSecurityPosture = {
  credentialClassCount: number;
  serverOnlyModuleCount: number;
  envGitignored: boolean;
  envExampleUsesPlaceholders: boolean;
  rotationBanner: string | null;
  notes: string[];
};

export function evaluateSecretsSecurityPosture(input: {
  trackedLeakCount: number;
  leakClasses: SecretCredentialClass[];
  envGitignored: boolean;
  envExampleClean: boolean;
}): SecretsSecurityPosture {
  const rotationBanner =
    input.trackedLeakCount > 0
      ? "ROTACIÓN DE CREDENCIALES REQUERIDA"
      : null;

  return {
    credentialClassCount: SECRET_CREDENTIAL_CATALOG.length,
    serverOnlyModuleCount: SERVER_ONLY_SECRET_MODULES.length,
    envGitignored: input.envGitignored,
    envExampleUsesPlaceholders: input.envExampleClean,
    rotationBanner,
    notes: [
      "Secretos solo vía variables de entorno (Vercel / .env.local gitignored).",
      "Service role y LLM keys en módulos server-only.",
      "security-gate.mjs + tests Fase 16 escanean el árbol versionado.",
      rotationBanner
        ? `Clases a rotar: ${[...new Set(input.leakClasses)].join(", ")}`
        : "Auditoría del repo versionado sin hallazgos de literales.",
    ],
  };
}
