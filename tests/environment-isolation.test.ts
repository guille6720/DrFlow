import { afterEach, describe, expect, it, vi } from "vitest";

import {
  evaluateEnvironmentIsolation,
  isNonProductionByPublicEnv,
  KNOWN_SUPABASE_PROJECTS,
  resolveAppEnvironment,
  supabaseRefFromJwtKey,
} from "@/core/environment/isolation.mjs";
import {
  assertExpectedSupabaseProject,
  assertNonProduction,
  EnvironmentIsolationError,
  getRuntimeEnvironment,
  isFiscalization,
  isProduction,
  isStaging,
} from "@/core/environment/runtime";

const PROD = KNOWN_SUPABASE_PROJECTS.production;
const STAGING = KNOWN_SUPABASE_PROJECTS.staging;
const FISCAL = "fiscalrefabcdefghijk";
const url = (ref: string) => `https://${ref}.supabase.co`;

/** Unsigned JWT-shaped string carrying only a `ref` claim (no real key material). */
function fakeJwt(ref: string) {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  return `${b64({ alg: "none" })}.${b64({ ref, role: "service_role" })}.sig`;
}

describe("environment isolation matrix (Phase 1L A–H)", () => {
  it("A: staging + staging DB → pass", () => {
    const r = evaluateEnvironmentIsolation({ APP_ENV: "staging", NEXT_PUBLIC_SUPABASE_URL: url(STAGING) });
    expect(r).toMatchObject({ ok: true, environment: "staging", errors: [] });
  });

  it("B: staging + production DB → fail", () => {
    const r = evaluateEnvironmentIsolation({ APP_ENV: "staging", NEXT_PUBLIC_SUPABASE_URL: url(PROD) });
    expect(r.ok).toBe(false);
    expect(r.errors).toContain("NON_PRODUCTION_USES_PRODUCTION_DB");
  });

  it("C: production + production DB → pass", () => {
    const r = evaluateEnvironmentIsolation({ APP_ENV: "production", NEXT_PUBLIC_SUPABASE_URL: url(PROD) });
    expect(r).toMatchObject({ ok: true, environment: "production" });
  });

  it("D: production + staging DB → fail", () => {
    const r = evaluateEnvironmentIsolation({ APP_ENV: "production", NEXT_PUBLIC_SUPABASE_URL: url(STAGING) });
    expect(r.ok).toBe(false);
    expect(r.errors).toContain("PRODUCTION_USES_STAGING_DB");
  });

  it("E: fiscalization + dedicated fiscalization DB → pass", () => {
    const r = evaluateEnvironmentIsolation({
      APP_ENV: "fiscalization",
      EXPECTED_SUPABASE_PROJECT_REF: FISCAL,
      NEXT_PUBLIC_SUPABASE_URL: url(FISCAL),
    });
    expect(r).toMatchObject({ ok: true, environment: "fiscalization" });
  });

  it("F: fiscalization + production DB → fail", () => {
    const r = evaluateEnvironmentIsolation({
      APP_ENV: "fiscalization",
      EXPECTED_SUPABASE_PROJECT_REF: FISCAL,
      NEXT_PUBLIC_SUPABASE_URL: url(PROD),
    });
    expect(r.ok).toBe(false);
    expect(r.errors).toEqual(expect.arrayContaining(["NON_PRODUCTION_USES_PRODUCTION_DB", "SUPABASE_PROJECT_MISMATCH"]));
  });

  it("G: fiscalization + staging DB → fail (even without an expected ref)", () => {
    const r = evaluateEnvironmentIsolation({ APP_ENV: "fiscalization", NEXT_PUBLIC_SUPABASE_URL: url(STAGING) });
    expect(r.ok).toBe(false);
    expect(r.errors).toEqual(
      expect.arrayContaining(["FISCALIZATION_USES_STAGING_DB", "EXPECTED_SUPABASE_PROJECT_REF_REQUIRED"])
    );
  });

  it("G2: fiscalization cannot declare staging/production as its dedicated project", () => {
    for (const ref of [STAGING, PROD]) {
      const r = evaluateEnvironmentIsolation({
        APP_ENV: "fiscalization",
        EXPECTED_SUPABASE_PROJECT_REF: ref,
        NEXT_PUBLIC_SUPABASE_URL: url(ref),
      });
      expect(r.errors).toContain("FISCALIZATION_PROJECT_NOT_DEDICATED");
    }
  });

  it("H: unknown APP_ENV → fail", () => {
    const r = evaluateEnvironmentIsolation({ APP_ENV: "qa-bananas", NEXT_PUBLIC_SUPABASE_URL: url(STAGING) });
    expect(r).toMatchObject({ ok: false, environment: "unknown" });
    expect(r.errors).toContain("APP_ENV_UNKNOWN");
  });

  it("H2: an unmapped Vercel custom environment is unknown → fail", () => {
    const r = evaluateEnvironmentIsolation({ VERCEL: "1", VERCEL_TARGET_ENV: "demo", NEXT_PUBLIC_SUPABASE_URL: url(STAGING) });
    expect(r.errors).toContain("APP_ENV_UNKNOWN");
  });
});

describe("environment resolution does not rely on NODE_ENV", () => {
  it("maps Vercel targets and aliases", () => {
    expect(resolveAppEnvironment({ VERCEL_ENV: "preview" }).environment).toBe("staging");
    expect(resolveAppEnvironment({ VERCEL_ENV: "production" }).environment).toBe("production");
    expect(resolveAppEnvironment({ VERCEL_ENV: "preview", VERCEL_TARGET_ENV: "fiscalizacion" }).environment).toBe(
      "fiscalization"
    );
    expect(resolveAppEnvironment({ APP_ENV: "fiscalizacion" }).environment).toBe("fiscalization");
    expect(resolveAppEnvironment({ NODE_ENV: "production" }).environment).toBe("development");
  });

  it("explicit APP_ENV wins over the Vercel target", () => {
    expect(resolveAppEnvironment({ APP_ENV: "staging", VERCEL_ENV: "production" }).environment).toBe("staging");
  });

  it("development may use a placeholder/local DB but never production", () => {
    expect(evaluateEnvironmentIsolation({ NEXT_PUBLIC_SUPABASE_URL: "https://placeholder.supabase.co" }).ok).toBe(true);
    expect(evaluateEnvironmentIsolation({ NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321" }).ok).toBe(true);
    expect(evaluateEnvironmentIsolation({ NEXT_PUBLIC_SUPABASE_URL: url(PROD) }).errors).toContain(
      "NON_PRODUCTION_USES_PRODUCTION_DB"
    );
  });

  it("deployed environments without a resolvable Supabase project fail closed", () => {
    expect(evaluateEnvironmentIsolation({ APP_ENV: "staging" }).errors).toContain("SUPABASE_URL_MISSING");
    expect(evaluateEnvironmentIsolation({ APP_ENV: "staging", NEXT_PUBLIC_SUPABASE_URL: "https://db.example.com" }).errors).toContain(
      "SUPABASE_REF_UNRESOLVED"
    );
  });
});

describe("key/project cross-checks", () => {
  it("reads only the ref claim of legacy JWT keys; opaque keys are ignored", () => {
    expect(supabaseRefFromJwtKey(fakeJwt(STAGING))).toBe(STAGING);
    expect(supabaseRefFromJwtKey("sb_secret_opaque")).toBeNull();
  });

  it("a production service-role key in staging fails even with a staging URL", () => {
    const r = evaluateEnvironmentIsolation({
      APP_ENV: "staging",
      NEXT_PUBLIC_SUPABASE_URL: url(STAGING),
      SUPABASE_SERVICE_ROLE_KEY: fakeJwt(PROD),
    });
    expect(r.errors).toEqual(expect.arrayContaining(["SERVICE_ROLE_PROJECT_MISMATCH", "NON_PRODUCTION_USES_PRODUCTION_DB"]));
  });

  it("warns when non-production public URLs point to production hosts", () => {
    const r = evaluateEnvironmentIsolation({
      APP_ENV: "staging",
      NEXT_PUBLIC_SUPABASE_URL: url(STAGING),
      NEXT_PUBLIC_APP_URL: "https://nexclinic.opusorg.com",
    });
    expect(r.ok).toBe(true);
    expect(r.warnings).toContain("NON_PRODUCTION_PUBLIC_URL_POINTS_TO_PRODUCTION:NEXT_PUBLIC_APP_URL");
  });

  it("errors never contain refs or key material", () => {
    const secret = fakeJwt(PROD);
    const r = evaluateEnvironmentIsolation({
      APP_ENV: "fiscalization",
      NEXT_PUBLIC_SUPABASE_URL: url(PROD),
      SUPABASE_SERVICE_ROLE_KEY: secret,
    });
    const text = JSON.stringify(r.errors) + JSON.stringify(r.warnings);
    expect(text).not.toContain(PROD);
    expect(text).not.toContain(secret);
  });
});

describe("single source of truth", () => {
  it("CLI safety refs match the runtime isolation refs", async () => {
    const refs = await import("../scripts/supabase-project-refs.mjs");
    expect(refs.STAGING_REF).toBe(STAGING);
    expect(refs.PRODUCTION_REF).toBe(PROD);
  });
});

describe("runtime API", () => {
  it("helpers classify environments", () => {
    const staging = { APP_ENV: "staging" };
    expect(getRuntimeEnvironment(staging)).toBe("staging");
    expect(isStaging(staging)).toBe(true);
    expect(isProduction({ APP_ENV: "production" })).toBe(true);
    expect(isFiscalization({ APP_ENV: "fiscalizacion" })).toBe(true);
  });

  it("assertNonProduction throws for production and unknown", () => {
    expect(() => assertNonProduction({ APP_ENV: "staging" })).not.toThrow();
    expect(() => assertNonProduction({ APP_ENV: "production" })).toThrow(EnvironmentIsolationError);
    expect(() => assertNonProduction({ APP_ENV: "???" })).toThrow(EnvironmentIsolationError);
  });

  it("assertExpectedSupabaseProject fails closed on mismatch", () => {
    expect(() => assertExpectedSupabaseProject({ APP_ENV: "staging", NEXT_PUBLIC_SUPABASE_URL: url(STAGING) })).not.toThrow();
    expect(() => assertExpectedSupabaseProject({ APP_ENV: "staging", NEXT_PUBLIC_SUPABASE_URL: url(PROD) })).toThrow(
      /NON_PRODUCTION_USES_PRODUCTION_DB/
    );
  });

  it("browser-side non-production detection uses only public values", () => {
    expect(isNonProductionByPublicEnv({ NEXT_PUBLIC_SUPABASE_URL: url(PROD) })).toBe(false);
    expect(isNonProductionByPublicEnv({ NEXT_PUBLIC_SUPABASE_URL: url(STAGING) })).toBe(true);
    expect(isNonProductionByPublicEnv({ NEXT_PUBLIC_APP_ENV: "production", NEXT_PUBLIC_SUPABASE_URL: url(STAGING) })).toBe(false);
    expect(isNonProductionByPublicEnv({ NEXT_PUBLIC_APP_ENV: "fiscalization" })).toBe(true);
    expect(isNonProductionByPublicEnv({})).toBe(false);
  });
});

describe("enforcement points", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("middleware gate answers 503 when isolation fails but keeps health probes reachable", async () => {
    const { environmentLockResponse } = await import("@/core/environment/guard");
    const broken = evaluateEnvironmentIsolation({ APP_ENV: "staging", NEXT_PUBLIC_SUPABASE_URL: url(PROD) });
    const locked = environmentLockResponse("/dashboard", broken);
    expect(locked?.status).toBe(503);
    const body = await locked!.json();
    expect(body.codes).toContain("NON_PRODUCTION_USES_PRODUCTION_DB");
    expect(JSON.stringify(body)).not.toContain(PROD);
    expect(environmentLockResponse("/api/health", broken)).toBeNull();
    const healthy = evaluateEnvironmentIsolation({ APP_ENV: "staging", NEXT_PUBLIC_SUPABASE_URL: url(STAGING) });
    expect(environmentLockResponse("/dashboard", healthy)).toBeNull();
  });

  it("service-role client refuses to start when staging points at production", async () => {
    vi.stubEnv("APP_ENV", "staging");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", url(PROD));
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "sb_secret_test");
    const { createAdminClient } = await import("@/core/supabase/admin");
    expect(() => createAdminClient()).toThrow(/Environment isolation check failed: NON_PRODUCTION_USES_PRODUCTION_DB/);
  });

  it("check:environment script reports labels and exits non-zero semantics on failure", async () => {
    const { runEnvironmentCheck } = await import("../scripts/check-environment.mjs");
    const lines: string[] = [];
    const log = { log: (m: string) => lines.push(m), warn: (m: string) => lines.push(m), error: (m: string) => lines.push(m) };
    expect(runEnvironmentCheck({ APP_ENV: "staging", NEXT_PUBLIC_SUPABASE_URL: url(STAGING) }, log).ok).toBe(true);
    expect(runEnvironmentCheck({ APP_ENV: "staging", NEXT_PUBLIC_SUPABASE_URL: url(PROD) }, log).ok).toBe(false);
    const output = lines.join("\n");
    expect(output).toContain("supabase=PRODUCTION");
    expect(output).not.toContain(PROD);
    expect(output).not.toContain(STAGING);
  });

  it("non-production never resolves public URLs to production hosts", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", url(STAGING));
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://nexclinic.opusorg.com");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://drflow-git-branch.vercel.app");
    const { getPublicSiteUrl } = await import("@/core/supabase/env");
    expect(getPublicSiteUrl()).toBe("https://drflow-git-branch.vercel.app");
  });

  it("production keeps its configured production URL", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", url(PROD));
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://nexclinic.opusorg.com");
    const { getPublicSiteUrl } = await import("@/core/supabase/env");
    expect(getPublicSiteUrl()).toBe("https://nexclinic.opusorg.com");
  });
});
