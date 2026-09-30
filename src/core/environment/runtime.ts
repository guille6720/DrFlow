import {
  type AppEnvironment,
  evaluateEnvironmentIsolation,
  type IsolationReport,
  resolveAppEnvironment,
} from "@/core/environment/isolation.mjs";

export type { AppEnvironment, IsolationReport };

export class EnvironmentIsolationError extends Error {
  readonly codes: string[];
  constructor(codes: string[]) {
    super(`Environment isolation check failed: ${codes.join(", ")}`);
    this.name = "EnvironmentIsolationError";
    this.codes = codes;
  }
}

type Env = Record<string, string | undefined>;

/**
 * Explicit reads so Next.js inlines NEXT_PUBLIC_* values; server-only values are simply undefined in the browser.
 * Secret values are only used to read the non-secret `ref` claim and never leave this module.
 */
function currentEnv(): Env {
  return {
    APP_ENV: process.env.APP_ENV,
    NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV,
    VERCEL: process.env.VERCEL,
    VERCEL_ENV: process.env.VERCEL_ENV,
    VERCEL_TARGET_ENV: process.env.VERCEL_TARGET_ENV,
    EXPECTED_SUPABASE_PROJECT_REF: process.env.EXPECTED_SUPABASE_PROJECT_REF,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    SITE_URL: process.env.SITE_URL,
    APP_URL: process.env.APP_URL,
  };
}

export function getEnvironmentIsolation(env: Env = currentEnv()): IsolationReport {
  return evaluateEnvironmentIsolation(env);
}

export function getRuntimeEnvironment(env: Env = currentEnv()): AppEnvironment | "unknown" {
  return resolveAppEnvironment(env).environment;
}

export const isProduction = (env?: Env) => getRuntimeEnvironment(env) === "production";
export const isStaging = (env?: Env) => getRuntimeEnvironment(env) === "staging";
export const isFiscalization = (env?: Env) => getRuntimeEnvironment(env) === "fiscalization";

/** Throws unless this is a known non-production environment (unknown counts as unsafe). */
export function assertNonProduction(env?: Env): void {
  const environment = getRuntimeEnvironment(env);
  if (environment === "production" || environment === "unknown") {
    throw new EnvironmentIsolationError([environment === "production" ? "PRODUCTION_FORBIDDEN" : "APP_ENV_UNKNOWN"]);
  }
}

/** Throws when APP_ENV and the connected Supabase project disagree (fail closed). */
export function assertExpectedSupabaseProject(env?: Env): void {
  const report = getEnvironmentIsolation(env);
  if (!report.ok) throw new EnvironmentIsolationError(report.errors);
}
