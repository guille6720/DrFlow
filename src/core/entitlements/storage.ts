import type { FeatureLimit } from "@/core/entitlements/types";

export const BYTES_PER_MB = 1024 * 1024;

export const STORAGE_LIMIT_MESSAGE = "Alcanzaste el almacenamiento de tu plan.";

export function bytesToMb(bytes: number): number {
  if (!Number.isFinite(bytes) || bytes <= 0) return 0;
  return Math.ceil(bytes / BYTES_PER_MB);
}

export function decideStorageCapacity(input: {
  enforced: boolean;
  catalogAvailable: boolean;
  limitMb: FeatureLimit | undefined;
  currentBytes: number;
  extraBytes: number;
}): { ok: true } | { ok: false; error: string } {
  if (!input.enforced) return { ok: true };
  if (!input.catalogAvailable) return { ok: true };
  if (input.extraBytes <= 0) return { ok: true };

  const limit = input.limitMb;
  if (limit === undefined || limit === null) return { ok: true };
  if (limit === 0) {
    return { ok: false, error: STORAGE_LIMIT_MESSAGE };
  }
  if (input.currentBytes + input.extraBytes > limit * BYTES_PER_MB) {
    return { ok: false, error: STORAGE_LIMIT_MESSAGE };
  }
  return { ok: true };
}
