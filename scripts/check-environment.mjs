/**
 * Environment isolation gate (build/pre-deploy/CI).
 *
 *   npm run check:environment
 *
 * Fails (exit 1) when APP_ENV and the connected Supabase project disagree, e.g. staging code with the
 * production database. Prints environment names, project LABELS and error codes only — never values.
 */
import nextEnv from "@next/env";

import { evaluateEnvironmentIsolation, KNOWN_SUPABASE_PROJECTS } from "../src/core/environment/isolation.mjs";

const { loadEnvConfig } = nextEnv;

/** @param {string | null} ref */
function label(ref) {
  if (!ref) return "none";
  if (ref === KNOWN_SUPABASE_PROJECTS.production) return "PRODUCTION";
  if (ref === KNOWN_SUPABASE_PROJECTS.staging) return "STAGING";
  return "OTHER (dedicated project)";
}

export function runEnvironmentCheck(env = process.env, log = console) {
  const report = evaluateEnvironmentIsolation(env);
  log.log(
    `[check:environment] environment=${report.environment} (source=${report.source}) ` +
      `supabase=${label(report.actualRef)} expected=${label(report.expectedRef)}`
  );
  for (const warning of report.warnings) log.warn(`[check:environment] WARNING ${warning}`);
  if (!report.ok) {
    log.error(`[check:environment] FAILED: ${report.errors.join(", ")}`);
    log.error("[check:environment] See docs/renapdis/PHASE-1-ENVIRONMENTS.md");
  } else {
    log.log("[check:environment] PASS");
  }
  return report;
}

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/").split("/").pop());
if (isMain) {
  loadEnvConfig(process.cwd(), false, { info: () => {}, error: console.error });
  process.exit(runEnvironmentCheck().ok ? 0 : 1);
}
