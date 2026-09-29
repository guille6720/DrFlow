/**
 * Server-side repository configuration (env only; never NEXT_PUBLIC_*).
 * No endpoint, credential or certificate value is defaulted or invented here.
 */

import type {
  RepositoryAuthMode,
  RepositoryProviderMode,
} from "@/core/renapdis/repository/repository-types";

export type EnvSource = Readonly<Record<string, string | undefined>>;

/** Provider ids with an adapter registered in `providers/index.ts`. Empty until a vendor is selected. */
export const EXTERNAL_REPOSITORY_PROVIDER_IDS: readonly string[] = [];

export const SANDBOX_REPOSITORY_PROVIDER_ID = "sandbox";

const AUTH_MODES: readonly RepositoryAuthMode[] = ["oauth2_client_credentials", "jwt_bearer", "mtls", "api_key"];

export type RepositoryConfig = {
  /** Raw provider id from env (lower-cased), or null when unset. */
  providerId: string | null;
  mode: RepositoryProviderMode;
  /** True only when the provider can actually be called. */
  configured: boolean;
  authMode: RepositoryAuthMode | null;
  /** Names of missing env vars (never values). */
  missing: string[];
  reason:
    | "ok"
    | "unset"
    | "unknown_provider"
    | "missing_credentials"
    | "adapter_not_registered"
    | "sandbox_blocked_in_production";
  apiUrl: string | null;
  timeoutMs: number;
};

const DEFAULT_TIMEOUT_MS = 15_000;

function read(env: EnvSource, key: string): string | null {
  const v = env[key]?.trim();
  return v ? v : null;
}

export function isProductionRuntime(env: EnvSource): boolean {
  return (env.VERCEL_ENV ?? "").trim() === "production";
}

function parseTimeout(env: EnvSource): number {
  const raw = Number(read(env, "RENAPDIS_REPOSITORY_TIMEOUT_MS"));
  if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_TIMEOUT_MS;
  return Math.min(Math.max(raw, 2_000), 60_000);
}

function requiredCredentialVars(authMode: RepositoryAuthMode | null): string[] {
  switch (authMode) {
    case "oauth2_client_credentials":
      return ["RENAPDIS_REPOSITORY_CLIENT_ID", "RENAPDIS_REPOSITORY_CLIENT_SECRET", "RENAPDIS_REPOSITORY_TOKEN_URL"];
    case "jwt_bearer":
      return ["RENAPDIS_REPOSITORY_CLIENT_ID", "RENAPDIS_REPOSITORY_JWT_PRIVATE_KEY"];
    case "mtls":
      return ["RENAPDIS_REPOSITORY_MTLS_CERT", "RENAPDIS_REPOSITORY_MTLS_KEY"];
    case "api_key":
      return ["RENAPDIS_REPOSITORY_CLIENT_SECRET"];
    default:
      return ["RENAPDIS_REPOSITORY_AUTH_MODE"];
  }
}

export function resolveRepositoryConfig(env: EnvSource = process.env): RepositoryConfig {
  const providerId = read(env, "RENAPDIS_REPOSITORY_PROVIDER")?.toLowerCase() ?? null;
  const timeoutMs = parseTimeout(env);
  const base = { providerId, timeoutMs, apiUrl: null, authMode: null, missing: [] as string[] };

  if (!providerId || providerId === "none") {
    return { ...base, mode: "not_configured", configured: false, reason: "unset", missing: ["RENAPDIS_REPOSITORY_PROVIDER"] };
  }

  if (providerId === SANDBOX_REPOSITORY_PROVIDER_ID) {
    if (isProductionRuntime(env)) {
      return { ...base, mode: "not_configured", configured: false, reason: "sandbox_blocked_in_production" };
    }
    return { ...base, mode: "sandbox", configured: true, reason: "ok" };
  }

  if (!/^[a-z][a-z0-9_-]{1,40}$/.test(providerId)) {
    return { ...base, mode: "not_configured", configured: false, reason: "unknown_provider" };
  }

  const authRaw = read(env, "RENAPDIS_REPOSITORY_AUTH_MODE");
  const authMode = AUTH_MODES.includes(authRaw as RepositoryAuthMode) ? (authRaw as RepositoryAuthMode) : null;
  const apiUrl = read(env, "RENAPDIS_REPOSITORY_API_URL");
  const missing = [
    ...(apiUrl && /^https:\/\//.test(apiUrl) ? [] : ["RENAPDIS_REPOSITORY_API_URL"]),
    ...requiredCredentialVars(authMode).filter((k) => !read(env, k)),
  ];

  if (!EXTERNAL_REPOSITORY_PROVIDER_IDS.includes(providerId)) {
    return {
      ...base,
      authMode,
      missing,
      mode: "not_configured",
      configured: false,
      reason: "adapter_not_registered",
    };
  }

  if (missing.length > 0) {
    return { ...base, authMode, missing, mode: "not_configured", configured: false, reason: "missing_credentials" };
  }

  return { ...base, apiUrl, authMode, missing, mode: "external", configured: true, reason: "ok" };
}

export type RefepsValidationConfig = {
  mode: "official" | "sandbox" | "unavailable";
  configured: boolean;
  /** True when legacy REFEPS_API_* vars are the only source (kept for backward compatibility). */
  usingLegacyVars: boolean;
  officialAdapterAvailable: boolean;
  reason: "ok" | "unset" | "official_adapter_not_implemented" | "sandbox_blocked_in_production";
};

/**
 * REFEPS professional validation config. The official REFEPS lookup contract has not been
 * provided, so even with URL/key present the official adapter reports unavailable.
 */
export function resolveRefepsValidationConfig(env: EnvSource = process.env): RefepsValidationConfig {
  const url = read(env, "REFEPS_VALIDATION_API_URL") ?? read(env, "REFEPS_API_URL");
  const key = read(env, "REFEPS_VALIDATION_API_KEY") ?? read(env, "REFEPS_API_KEY");
  const usingLegacyVars = !read(env, "REFEPS_VALIDATION_API_URL") && Boolean(read(env, "REFEPS_API_URL"));
  const sandboxRequested = read(env, "REFEPS_VALIDATION_MODE")?.toLowerCase() === "sandbox";

  if (url && key) {
    return { mode: "unavailable", configured: false, usingLegacyVars, officialAdapterAvailable: false, reason: "official_adapter_not_implemented" };
  }
  if (sandboxRequested) {
    if (isProductionRuntime(env)) {
      return { mode: "unavailable", configured: false, usingLegacyVars, officialAdapterAvailable: false, reason: "sandbox_blocked_in_production" };
    }
    return { mode: "sandbox", configured: true, usingLegacyVars, officialAdapterAvailable: false, reason: "ok" };
  }
  return { mode: "unavailable", configured: false, usingLegacyVars, officialAdapterAvailable: false, reason: "unset" };
}
