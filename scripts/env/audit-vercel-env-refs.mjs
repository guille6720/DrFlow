#!/usr/bin/env node
/**
 * Read-only audit: which Supabase project each Vercel scope points to.
 *
 * Pulls one scope at a time into a temp file (outside the repo), prints ONLY variable names, presence and the
 * non-secret Supabase project ref (URL subdomain / `ref` claim of legacy JWT keys), then deletes the file.
 * Secret values are never printed. Never writes to Vercel.
 *
 *   node scripts/env/audit-vercel-env-refs.mjs preview
 *   node scripts/env/audit-vercel-env-refs.mjs preview --git-branch=release/0.2.19-staging-promotion
 *   node scripts/env/audit-vercel-env-refs.mjs fiscalizacion
 */
import { spawnSync } from "child_process";
import { mkdtempSync, readFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

import { PRODUCTION_REF, STAGING_REF } from "../supabase-project-refs.mjs";

const scope = process.argv[2];
const branchArg = process.argv.find((a) => a.startsWith("--git-branch="));
if (!scope) {
  console.error("Usage: audit-vercel-env-refs.mjs <development|preview|production|custom-env> [--git-branch=x]");
  process.exit(2);
}

const WATCH = [
  "APP_ENV",
  "NEXT_PUBLIC_APP_ENV",
  "EXPECTED_SUPABASE_PROJECT_REF",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "DATABASE_URL",
  "DIRECT_URL",
  "NEXT_PUBLIC_SITE_URL",
  "NEXT_PUBLIC_APP_URL",
  "FISCALIZATION_PUBLIC_URL",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "SENTRY_DSN",
  "NEXT_PUBLIC_SENTRY_DSN",
  "CRON_SECRET",
  "SMTP_HOST",
  "EMAIL_FROM",
  "NEXT_PUBLIC_RCTA_URL",
  "NEXT_PUBLIC_PAMI_PRESCRIPTION_URL",
  "NEXT_PUBLIC_PAMI_OME_URL",
];

function parseEnv(text) {
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (!m) continue;
    out[m[1]] = m[2].replace(/^"(.*)"$/, "$1").replace(/\\n$/, "").trim();
  }
  return out;
}

function label(ref) {
  if (!ref) return "";
  if (ref === PRODUCTION_REF) return `${ref} (PRODUCTION)`;
  if (ref === STAGING_REF) return `${ref} (STAGING)`;
  return `${ref} (OTHER)`;
}

function refFromUrl(value) {
  try {
    const host = new URL(value).hostname;
    const m = /^([a-z0-9]{20})\.supabase\.co$/.exec(host);
    return m ? m[1] : null;
  } catch {
    const m = /@db\.([a-z0-9]{20})\.supabase\.co|postgres\.([a-z0-9]{20})[:@]/.exec(value);
    return m ? (m[1] ?? m[2]) : null;
  }
}

function refFromJwt(value) {
  if (!value.startsWith("eyJ")) return null;
  try {
    const payload = JSON.parse(Buffer.from(value.split(".")[1], "base64url").toString("utf8"));
    return typeof payload.ref === "string" ? payload.ref : null;
  } catch {
    return null;
  }
}

function describe(name, value) {
  if (!value) return { presence: "no", target: "" };
  const urlRef = refFromUrl(value);
  if (urlRef) return { presence: "yes", target: label(urlRef) };
  const jwtRef = refFromJwt(value);
  if (jwtRef) return { presence: "yes", target: `${label(jwtRef)} [jwt ref claim]` };
  if (/^sb_(publishable|secret)_/.test(value)) return { presence: "yes", target: "opaque new-format key" };
  if (name === "APP_ENV" || name === "NEXT_PUBLIC_APP_ENV" || name === "EXPECTED_SUPABASE_PROJECT_REF") {
    return { presence: "yes", target: name === "EXPECTED_SUPABASE_PROJECT_REF" ? label(value) : value };
  }
  if (/^https?:\/\//.test(value) && /(SITE|APP|PUBLIC)_URL$/.test(name)) {
    try {
      return { presence: "yes", target: new URL(value).hostname };
    } catch {
      return { presence: "yes", target: "" };
    }
  }
  if (!/^https?:|^eyJ|^sb_|^postgres/.test(value)) {
    return { presence: "yes", target: "unreadable (Vercel Sensitive value; not exposed by env pull)" };
  }
  return { presence: "yes", target: "" };
}

const dir = mkdtempSync(join(tmpdir(), "nexclinic-env-audit-"));
const file = join(dir, "pulled.env");
try {
  const args = ["vercel", "env", "pull", file, "--yes", `--environment=${scope}`];
  if (branchArg) args.push(branchArg);
  const res = spawnSync(args.join(" ").replace(/^vercel/, "npx vercel"), { encoding: "utf8", shell: true });
  if (res.status !== 0) {
    console.error(`vercel env pull failed for scope=${scope} (exit ${res.status})`);
    process.exit(1);
  }
  const env = parseEnv(readFileSync(file, "utf8"));
  console.log(`# scope=${scope}${branchArg ? ` ${branchArg}` : ""}`);
  for (const name of WATCH) {
    const d = describe(name, env[name]);
    console.log(`${name} | presence: ${d.presence}${d.target ? ` | target: ${d.target}` : ""}`);
  }
  const typo = Object.keys(env).filter((k) => /^NEXT_PUBLIC_SITE_UR$/.test(k));
  if (typo.length) console.log(`WARNING suspicious variable names: ${typo.join(", ")}`);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
