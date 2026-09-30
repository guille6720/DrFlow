/**
 * NexClinic environment isolation — single source of truth (pure, runtime-agnostic: Node, Edge, scripts, tests).
 *
 * Every deployment declares WHICH environment it is (APP_ENV) and WHICH Supabase project it must use
 * (EXPECTED_SUPABASE_PROJECT_REF, with safe defaults for known environments). A mismatch fails closed:
 * the build aborts (scripts/check-environment.mjs), the middleware answers 503 and the service-role client
 * refuses to start.
 *
 * Never returns or logs secret values. Project refs are identifiers, not credentials, but they are only
 * exposed to operators (scripts/logs), never to end users.
 */

/** @typedef {"development" | "staging" | "fiscalization" | "production"} AppEnvironment */

/** @type {readonly AppEnvironment[]} */
export const APP_ENVIRONMENTS = ["development", "staging", "fiscalization", "production"];

/** Known Supabase projects. Fiscalization has no project yet: it must be declared explicitly. */
export const KNOWN_SUPABASE_PROJECTS = Object.freeze({
  production: "nipqdarduknydqptqzup",
  staging: "gprmsufvhabntbrytwyi",
});

/** Public hosts that serve PRODUCTION. Non-production deployments must never send users there. */
export const PRODUCTION_PUBLIC_HOSTS = Object.freeze(["nexclinic.opusorg.com", "drflow-app-rho.vercel.app"]);

const ALIASES = /** @type {Record<string, AppEnvironment>} */ ({
  development: "development",
  dev: "development",
  local: "development",
  staging: "staging",
  preview: "staging",
  fiscalization: "fiscalization",
  fiscalizacion: "fiscalization",
  production: "production",
  prod: "production",
});

/** @param {string | undefined | null} value */
function clean(value) {
  return (value ?? "").trim();
}

/**
 * `https://<ref>.supabase.co` → `<ref>`. Returns null for anything else (localhost, placeholders, custom).
 * @param {string | undefined | null} url
 * @returns {string | null}
 */
export function supabaseRefFromUrl(url) {
  const value = clean(url);
  if (!value) return null;
  try {
    const m = /^([a-z0-9]{20})\.supabase\.(co|in)$/.exec(new URL(value).hostname);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

/**
 * `ref` claim of a legacy Supabase JWT key (anon/service_role). New opaque keys (sb_…) return null.
 * Only the non-secret `ref` claim is read; the key itself is never returned.
 * @param {string | undefined | null} key
 * @returns {string | null}
 */
export function supabaseRefFromJwtKey(key) {
  const value = clean(key);
  if (!value.startsWith("eyJ")) return null;
  const part = value.split(".")[1];
  if (!part) return null;
  try {
    const b64 = part.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(part.length / 4) * 4, "=");
    const payload = JSON.parse(atob(b64));
    return typeof payload?.ref === "string" ? payload.ref : null;
  } catch {
    return null;
  }
}

/**
 * APP_ENV (explicit) → Vercel target → local development. Never relies on NODE_ENV.
 * @param {Record<string, string | undefined>} env
 * @returns {{ environment: AppEnvironment | "unknown"; source: string; raw: string }}
 */
export function resolveAppEnvironment(env) {
  const explicit = clean(env.APP_ENV) || clean(env.NEXT_PUBLIC_APP_ENV);
  if (explicit) {
    const mapped = ALIASES[explicit.toLowerCase()];
    return { environment: mapped ?? "unknown", source: "APP_ENV", raw: explicit };
  }
  const vercelTarget = clean(env.VERCEL_TARGET_ENV) || clean(env.VERCEL_ENV);
  if (vercelTarget) {
    const mapped = ALIASES[vercelTarget.toLowerCase()];
    return { environment: mapped ?? "unknown", source: "VERCEL_TARGET_ENV", raw: vercelTarget };
  }
  if (clean(env.VERCEL) === "1") return { environment: "unknown", source: "VERCEL", raw: "" };
  return { environment: "development", source: "default", raw: "" };
}

/**
 * @param {AppEnvironment | "unknown"} environment
 * @param {Record<string, string | undefined>} env
 * @returns {string | null}
 */
export function expectedSupabaseRef(environment, env) {
  const declared = clean(env.EXPECTED_SUPABASE_PROJECT_REF);
  if (declared) return declared;
  if (environment === "production") return KNOWN_SUPABASE_PROJECTS.production;
  if (environment === "staging") return KNOWN_SUPABASE_PROJECTS.staging;
  return null;
}

/** @param {string | undefined | null} url */
function hostOf(url) {
  const value = clean(url);
  if (!value) return null;
  try {
    return new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * @typedef {{
 *   ok: boolean;
 *   environment: AppEnvironment | "unknown";
 *   source: string;
 *   expectedRef: string | null;
 *   actualRef: string | null;
 *   errors: string[];
 *   warnings: string[];
 * }} IsolationReport
 */

/**
 * Evaluates the whole environment contract. `errors` are stable codes (no secrets, no refs).
 * @param {Record<string, string | undefined>} env
 * @returns {IsolationReport}
 */
export function evaluateEnvironmentIsolation(env) {
  const { environment, source } = resolveAppEnvironment(env);
  const errors = [];
  const warnings = [];
  const url = clean(env.NEXT_PUBLIC_SUPABASE_URL);
  const actualRef = supabaseRefFromUrl(url);
  const expectedRef = expectedSupabaseRef(environment, env);
  const { production: PROD, staging: STAGING } = KNOWN_SUPABASE_PROJECTS;

  if (environment === "unknown") errors.push("APP_ENV_UNKNOWN");

  const deployed = environment === "staging" || environment === "fiscalization" || environment === "production";
  if (!url) {
    (deployed ? errors : warnings).push("SUPABASE_URL_MISSING");
  } else if (!actualRef && deployed) {
    errors.push("SUPABASE_REF_UNRESOLVED");
  }

  if (environment !== "production" && actualRef === PROD) errors.push("NON_PRODUCTION_USES_PRODUCTION_DB");
  if (environment === "production" && actualRef === STAGING) errors.push("PRODUCTION_USES_STAGING_DB");
  if (environment === "fiscalization") {
    if (actualRef === STAGING) errors.push("FISCALIZATION_USES_STAGING_DB");
    if (!expectedRef) errors.push("EXPECTED_SUPABASE_PROJECT_REF_REQUIRED");
    else if (expectedRef === PROD || expectedRef === STAGING) errors.push("FISCALIZATION_PROJECT_NOT_DEDICATED");
  }
  if (environment !== "production" && expectedRef === PROD) errors.push("NON_PRODUCTION_EXPECTS_PRODUCTION_DB");
  if (environment === "production" && expectedRef && expectedRef !== PROD) errors.push("PRODUCTION_EXPECTS_OTHER_DB");

  if (expectedRef && actualRef && expectedRef !== actualRef) errors.push("SUPABASE_PROJECT_MISMATCH");

  for (const [name, code] of [
    ["SUPABASE_SERVICE_ROLE_KEY", "SERVICE_ROLE_PROJECT_MISMATCH"],
    ["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "PUBLISHABLE_KEY_PROJECT_MISMATCH"],
    ["NEXT_PUBLIC_SUPABASE_ANON_KEY", "PUBLISHABLE_KEY_PROJECT_MISMATCH"],
  ]) {
    const keyRef = supabaseRefFromJwtKey(env[name]);
    if (keyRef && actualRef && keyRef !== actualRef && !errors.includes(code)) errors.push(code);
    if (keyRef && environment !== "production" && keyRef === PROD && !errors.includes("NON_PRODUCTION_USES_PRODUCTION_DB")) {
      errors.push("NON_PRODUCTION_USES_PRODUCTION_DB");
    }
  }

  if (environment !== "production") {
    for (const name of ["NEXT_PUBLIC_APP_URL", "NEXT_PUBLIC_SITE_URL", "SITE_URL", "APP_URL"]) {
      const host = hostOf(env[name]);
      if (host && PRODUCTION_PUBLIC_HOSTS.includes(host)) {
        warnings.push(`NON_PRODUCTION_PUBLIC_URL_POINTS_TO_PRODUCTION:${name}`);
      }
    }
  }

  return { ok: errors.length === 0, environment, source, expectedRef, actualRef, errors, warnings };
}

/**
 * Positive non-production detection usable in the browser, where only NEXT_PUBLIC_* values exist.
 * Unconfigured builds return false; deployed ones in that state are locked by the middleware anyway.
 * @param {Record<string, string | undefined>} env
 */
export function isNonProductionByPublicEnv(env) {
  const explicit = clean(env.NEXT_PUBLIC_APP_ENV).toLowerCase();
  if (explicit) return ALIASES[explicit] !== "production";
  const ref = supabaseRefFromUrl(env.NEXT_PUBLIC_SUPABASE_URL);
  return ref !== null && ref !== KNOWN_SUPABASE_PROJECTS.production;
}
