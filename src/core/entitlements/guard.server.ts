import "server-only";

import { redirect } from "next/navigation";

import { requireClinicPermission } from "@/core/actions/clinic-guard";
import { requireAddonFeatureAccess, requireFeature } from "@/core/entitlements/entitlements.server";
import type { FeatureKey } from "@/core/entitlements/features";
import { FeatureRequiredError } from "@/core/entitlements/types";
import type { PermissionKey } from "@/core/permissions/roles";

export async function requireAddonFeatureOrRedirect(featureKey: FeatureKey): Promise<void> {
  try {
    await requireFeature({ featureKey });
  } catch (error) {
    if (error instanceof FeatureRequiredError) {
      redirect(`/planes?modulo=${encodeURIComponent(featureKey)}`);
    }
    throw error;
  }
}

export async function requirePermissionAndAddon(
  permission: PermissionKey,
  featureKey: FeatureKey
) {
  const access = await requireClinicPermission(permission);
  if (!access.ok) return access;
  const addon = await requireAddonFeatureAccess(featureKey);
  if (!addon.ok) return addon;
  return access;
}
