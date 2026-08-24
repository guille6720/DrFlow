import "server-only";

import {
  ADDON_SUSPENDED_MESSAGE,
  isSuspendedCommercialStatus,
} from "@/core/entitlements/commercial-status";
import { isFeatureEnforced } from "@/core/entitlements/enforcement";
import { getClinicEntitlements } from "@/core/entitlements/entitlements.server";
import { parseEntitlementsPayload } from "@/core/entitlements/entitlements-payload";
import type { FeatureKey } from "@/core/entitlements/features";
import {
  decideMeteredUsageGate,
  isUsageRpcUnavailable,
} from "@/core/entitlements/metered-gate";
import { canUseFeatureWithCommercialStatus, lookupFeature } from "@/core/entitlements/resolve";
import type { ResolvedClinicEntitlements } from "@/core/entitlements/types";
import {
  tryConsumeFeatureUsage,
  tryConsumeFeatureUsageAsSystem,
} from "@/core/entitlements/usage.server";
import { createAdminClient, hasAdminClient } from "@/core/supabase/admin";

function addonDeniedMessage(
  entitlements: ResolvedClinicEntitlements,
  featureKey: FeatureKey
): string {
  const resolved = lookupFeature(entitlements, featureKey);
  const suspendedWithoutOverride =
    entitlements.catalogAvailable &&
    isSuspendedCommercialStatus(entitlements.status, entitlements.trialEndsAt) &&
    resolved?.source !== "override";
  return suspendedWithoutOverride
    ? ADDON_SUSPENDED_MESSAGE
    : "Esta función no está incluida en el plan del consultorio.";
}

export async function consumeAddonUsage(args: {
  featureKey: FeatureKey;
  amount?: number;
  clinicId?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const amount = args.amount ?? 1;
  if (!isFeatureEnforced(args.featureKey)) return { ok: true };

  const entitlements = await getClinicEntitlements({ clinicId: args.clinicId });
  if (!entitlements.catalogAvailable) return { ok: true };
  if (!canUseFeatureWithCommercialStatus(entitlements, args.featureKey)) {
    return { ok: false, error: addonDeniedMessage(entitlements, args.featureKey) };
  }

  const consume = await tryConsumeFeatureUsage({
    featureKey: args.featureKey,
    amount,
    clinicId: args.clinicId,
  });

  return decideMeteredUsageGate({
    enforced: true,
    catalogAvailable: true,
    rpcUnavailable: !consume.ok && isUsageRpcUnavailable(consume.error),
    consumeOk: consume.ok,
    consumeError: consume.ok ? null : consume.error,
  });
}

/** Jobs / service_role. Does not require a user session. Missing RPC fails open. */
export async function consumeAddonUsageAsSystem(args: {
  clinicId: string;
  featureKey: FeatureKey;
  amount?: number;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const amount = args.amount ?? 1;
  if (!isFeatureEnforced(args.featureKey)) return { ok: true };
  if (!args.clinicId) return { ok: true };
  if (!hasAdminClient()) return { ok: true };

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("get_clinic_entitlements", {
    p_clinic_id: args.clinicId,
  });
  if (error) return { ok: true };

  const entitlements = parseEntitlementsPayload(data, args.clinicId);
  if (!entitlements.catalogAvailable) return { ok: true };
  if (!canUseFeatureWithCommercialStatus(entitlements, args.featureKey)) {
    return { ok: false, error: addonDeniedMessage(entitlements, args.featureKey) };
  }

  const consume = await tryConsumeFeatureUsageAsSystem({
    clinicId: args.clinicId,
    featureKey: args.featureKey,
    amount,
  });

  return decideMeteredUsageGate({
    enforced: true,
    catalogAvailable: true,
    rpcUnavailable: !consume.ok && isUsageRpcUnavailable(consume.error),
    consumeOk: consume.ok,
    consumeError: consume.ok ? null : consume.error,
  });
}
