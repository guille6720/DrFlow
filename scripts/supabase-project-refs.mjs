/**
 * Shared Supabase project identity for DrFlow safety gates.
 * Never store or print service-role secrets here.
 */
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

export const STAGING_REF = "gprmsufvhabntbrytwyi";
export const STAGING_NAME = "DrFlow-Staging";
export const PRODUCTION_REF = "nipqdarduknydqptqzup";
export const PRODUCTION_NAME = "DrFlow (production)";

export function linkedProjectRefPath(cwd = process.cwd()) {
  return resolve(cwd, "supabase/.temp/project-ref");
}

export function readLinkedProjectRef(cwd = process.cwd()) {
  const path = linkedProjectRefPath(cwd);
  if (!existsSync(path)) return null;
  return readFileSync(path, "utf8").trim() || null;
}

/**
 * Abort unless CLI link is DrFlow-Staging.
 * Does not rewrite config.toml (production project_id may remain for auth URL tooling).
 */
export function assertLinkedStagingOrExit(cwd = process.cwd()) {
  const linked = readLinkedProjectRef(cwd);
  if (linked === PRODUCTION_REF) {
    console.error(
      `\nERROR: Linked project is ${PRODUCTION_NAME} (${PRODUCTION_REF}).\n` +
        `Relink to ${STAGING_NAME} (${STAGING_REF}) before staging migration commands.\n` +
        `Production pushes require a separate explicit workflow.\n`
    );
    process.exit(1);
  }
  if (linked && linked !== STAGING_REF) {
    console.error(
      `\nERROR: Linked project-ref is "${linked}".\n` +
        `Expected ${STAGING_NAME} (${STAGING_REF}).\n`
    );
    process.exit(1);
  }
  return linked;
}
