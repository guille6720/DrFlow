import "server-only";

import { z } from "zod";

const productionServerEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(10),
  NEXT_PUBLIC_SITE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  CRON_SECRET: z.string().min(16),
});

export type ProductionEnvCheck = {
  ok: boolean;
  environment: string;
  missing: string[];
  warnings: string[];
};

/** Validates required production secrets — call at startup or pre-deploy. */
export function validateProductionEnv(options?: { throwOnError?: boolean }): ProductionEnvCheck {
  const isProd = process.env.NODE_ENV === "production";
  const missing: string[] = [];
  const warnings: string[] = [];

  if (!isProd) {
    return { ok: true, environment: process.env.NODE_ENV ?? "development", missing, warnings };
  }

  const parsed = productionServerEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      missing.push(String(issue.path[0] ?? issue.message));
    }
  }

  if (!process.env.DATABASE_URL?.trim()) {
    warnings.push("DATABASE_URL unset — backups/migrations require manual setup");
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
