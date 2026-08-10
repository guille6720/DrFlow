import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";

import { createAdminClient, hasAdminClient } from "@/core/supabase/admin";
import { createClient } from "@/core/supabase/server";

/** Conservative TTLs for semi-static clinic metadata (seconds). */
export const CLINIC_METADATA_TTL = {
  plugins: 120,
  featureFlags: 120,
  portal: 300,
  professionals: 300,
  locations: 600,
  specialties: 600,
  clinicalTemplates: 600,
  pamiPlanillas: 600,
  clinicSettings: 300,
} as const;

type ClinicMetadataCacheOpts = {
  key: string;
  clinicId: string;
  tag: string;
  revalidate: number;
};

/**
 * Cross-request cache for clinic-scoped reads.
 * Uses service-role client inside unstable_cache (no cookies).
 * Auth/RLS gate must happen before calling — cache key is clinicId.
 */
export async function withClinicMetadataCache<T>(
  opts: ClinicMetadataCacheOpts,
  loader: (supabase: SupabaseClient) => Promise<T>
): Promise<T> {
  if (!hasAdminClient()) {
    const supabase = await createClient();
    return loader(supabase);
  }

  return unstable_cache(
    async () => loader(createAdminClient()),
    ["clinic-metadata", opts.key, opts.clinicId],
    { revalidate: opts.revalidate, tags: [opts.tag] }
  )();
}

/** Global reference data (no PHI) — safe to cache cross-request. */
export async function withReferenceDataCache<T>(
  keyParts: string[],
  tag: string,
  revalidate: number,
  loader: (supabase: SupabaseClient) => Promise<T>
): Promise<T> {
  if (!hasAdminClient()) {
    const supabase = await createClient();
    return loader(supabase);
  }

  return unstable_cache(
    async () => loader(createAdminClient()),
    ["reference-data", ...keyParts],
    { revalidate, tags: [tag] }
  )();
}
