import "server-only";

import { z } from "zod";

import { normalizePublicUrl } from "@/core/supabase/env";

const coreProductionEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(10),
});

export type ProductionEnvCheck = {
  ok: boolean;
  environment: string;
  missing: string[];
  warnings: string[];
};

function resolvePublishableKey(): string | undefined {
  const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (publishable) return publishable;

  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (anon && !anon.includes("placeholder")) return anon;

  return undefined;
}

function resolveSiteUrl(): string | undefined {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!configured) return undefined;

  try {
    return normalizePublicUrl(configured);
  } catch {
    return undefined;
  }
}

/** Validates production env — missing core keys block readiness; ops secrets warn only. */
export function validateProductionEnv(options?: { throwOnError?: boolean }): ProductionEnvCheck {
  const isProd = process.env.NODE_ENV === "production";
  const missing: string[] = [];
  const warnings: string[] = [];

  if (!isProd) {
    return { ok: true, environment: process.env.NODE_ENV ?? "development", missing, warnings };
  }

  const publishableKey = resolvePublishableKey();
  const parsed = coreProductionEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishableKey,
  });

  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      missing.push(String(issue.path[0] ?? issue.message));
    }
  }

  if (!resolveSiteUrl()) {
    warnings.push("NEXT_PUBLIC_SITE_URL unset or invalid — using VERCEL_URL fallback");
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    warnings.push("SUPABASE_SERVICE_ROLE_KEY unset — jobs/observability persistence disabled");
  }

  if (!process.env.CRON_SECRET?.trim() || process.env.CRON_SECRET.trim().length < 16) {
    warnings.push("CRON_SECRET unset or too short — cron endpoints will reject requests");
  }

  if (!process.env.DATABASE_URL?.trim()) {
    warnings.push("DATABASE_URL unset — backups/migrations require manual setup");
  }

  if (!process.env.SENTRY_DSN?.trim()) {
    warnings.push("SENTRY_DSN unset — external error tracking disabled (internal observability still active)");
  }

  const result: ProductionEnvCheck = {
    ok: missing.length === 0,
    environment: "production",
    missing: [...new Set(missing)],
    warnings,
  };

  if (!result.ok && options?.throwOnError !== false) {
    throw new Error(
      `Production env incomplete: ${result.missing.join(", ")}. See .env.example and PRODUCTION_READINESS_REPORT.md`
    );
  }

  return result;
}
