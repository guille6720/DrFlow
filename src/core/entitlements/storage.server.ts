import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { isStorageLimitEnforced } from "@/core/entitlements/enforcement";
import { parseEntitlementsPayload } from "@/core/entitlements/entitlements-payload";
import { FEATURES } from "@/core/entitlements/features";
import { lookupFeature } from "@/core/entitlements/resolve";
import { decideStorageCapacity } from "@/core/entitlements/storage";
import { createClient } from "@/core/supabase/server";

/**
 * WARNING: incomplete storage metering must fail open (return null).
 * Never delete clinical files to “enforce” a storage cap.
 */
function parseSumPayload(data: unknown): number | null {
  if (data == null) return 0;
  if (typeof data === "number" && Number.isFinite(data)) return data;
  if (typeof data !== "object") return null;
  const row = data as Record<string, unknown>;
  const nested = row.file_size;
  if (typeof nested === "number" && Number.isFinite(nested)) return nested;
  if (nested && typeof nested === "object" && "sum" in nested) {
    const sum = Number((nested as { sum: unknown }).sum);
    return Number.isFinite(sum) ? sum : 0;
  }
  if (typeof row.sum === "number" && Number.isFinite(row.sum)) return row.sum;
  return 0;
}

async function sumFileSizeColumn(
  supabase: SupabaseClient,
  table: "patient_attachments" | "patient_admin_documents",
  clinicId: string
): Promise<number | null> {
  const aggregated = await supabase
    .from(table)
    .select("file_size.sum()")
    .eq("clinic_id", clinicId)
    .maybeSingle();

  if (!aggregated.error) {
    return parseSumPayload(aggregated.data);
  }

  const fallback = await supabase.from(table).select("file_size").eq("clinic_id", clinicId).limit(8000);
  if (fallback.error) return null;
  return (fallback.data ?? []).reduce((total, row) => {
    const size = Number((row as { file_size?: number | null }).file_size ?? 0);
    return total + (Number.isFinite(size) ? size : 0);
  }, 0);
}

/** null = unknown (fail open). */
export async function getClinicStorageBytes(
  supabase: SupabaseClient,
  clinicId: string
): Promise<number | null> {
  const [attachments, adminDocs] = await Promise.all([
    sumFileSizeColumn(supabase, "patient_attachments", clinicId),
    sumFileSizeColumn(supabase, "patient_admin_documents", clinicId),
  ]);
  if (attachments === null && adminDocs === null) return null;
  return (attachments ?? 0) + (adminDocs ?? 0);
}

export async function assertClinicStorageCapacity(args: {
  clinicId: string;
  extraBytes: number;
  supabase?: SupabaseClient;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isStorageLimitEnforced()) return { ok: true };

  const supabase = args.supabase ?? (await createClient());
  const { data, error } = await supabase.rpc("get_clinic_entitlements", {
    p_clinic_id: args.clinicId,
  });
  if (error) return { ok: true };

  const entitlements = parseEntitlementsPayload(data, args.clinicId);

  const currentBytes = await getClinicStorageBytes(supabase, args.clinicId);
  if (currentBytes === null) return { ok: true };

  return decideStorageCapacity({
    enforced: true,
    catalogAvailable: entitlements.catalogAvailable,
    limitMb: lookupFeature(entitlements, FEATURES.STORAGE_MAX_MB)?.limit,
    currentBytes,
    extraBytes: args.extraBytes,
  });
}
