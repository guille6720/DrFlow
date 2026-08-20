import "server-only";

import { z } from "zod";

import { getActiveClinicId } from "@/core/auth/session.server";
import { type FeatureKey, isMeteredFeature } from "@/core/entitlements/features";
import { USAGE_RPC_UNAVAILABLE } from "@/core/entitlements/metered-gate";
import { resolveTrustedClinicId } from "@/core/entitlements/trusted-clinic";
import type { UsageIncrementResult } from "@/core/entitlements/types";
import { isPositiveUsageAmount } from "@/core/entitlements/usage-period";
import { logServerError } from "@/core/errors/log-error.server";
import { getRpcCode, isUndefinedFunction } from "@/core/errors/postgres-error";
import { createAdminClient, hasAdminClient } from "@/core/supabase/admin";
import { createClient } from "@/core/supabase/server";

const usageSuccessSchema = z.object({
  ok: z.literal(true),
  amount: z.number(),
  period_start: z.union([z.string(), z.null()]).optional(),
});

const usageFailureSchema = z.object({
  ok: z.literal(false),
  error: z.string(),
});

type UsageArgs = {
  featureKey: FeatureKey;
  amount: number;
  organizationId?: string | null;
  clinicId?: string | null;
};

function usageError(error: string): UsageIncrementResult {
  return { ok: false, error };
}

async function trustedUsageClinicId(args: UsageArgs): Promise<string | null> {
  const sessionClinicId = await getActiveClinicId();
  return resolveTrustedClinicId(sessionClinicId, args.clinicId ?? args.organizationId ?? undefined);
}

function parseUsageRpc(data: unknown, error: { message?: string } | null): UsageIncrementResult {
  if (error) {
    if (isUndefinedFunction(error)) return usageError(USAGE_RPC_UNAVAILABLE);
    const code = getRpcCode(error) ?? error.message ?? "USAGE_RPC_FAILED";
    return usageError(code);
  }
  const success = usageSuccessSchema.safeParse(data);
  if (success.success) {
    return {
      ok: true,
      amount: success.data.amount,
      periodStart: String(success.data.period_start ?? ""),
    };
  }
  const failure = usageFailureSchema.safeParse(data);
  if (failure.success) return usageError(failure.data.error);
  return usageError("USAGE_RPC_FAILED");
}

async function invokeUsageRpc(
  rpcName: "increment_feature_usage" | "try_consume_feature_usage",
  args: UsageArgs
): Promise<UsageIncrementResult> {
  if (!isPositiveUsageAmount(args.amount)) return usageError("INVALID_AMOUNT");
  if (!isMeteredFeature(args.featureKey)) return usageError("FEATURE_NOT_METERED");

  const clinicId = await trustedUsageClinicId(args);
  if (!clinicId) return usageError("FORBIDDEN");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc(rpcName, {
    p_clinic_id: clinicId,
    p_feature_key: args.featureKey,
    p_amount: args.amount,
  });

  if (error) {
    logServerError(`entitlements.${rpcName}`, error, { clinicId, persist: false });
  }

  return parseUsageRpc(data, error);
}

export async function incrementFeatureUsage(args: UsageArgs): Promise<UsageIncrementResult> {
  return invokeUsageRpc("increment_feature_usage", args);
}

export async function tryConsumeFeatureUsage(args: UsageArgs): Promise<UsageIncrementResult> {
  return invokeUsageRpc("try_consume_feature_usage", args);
}

export async function tryConsumeFeatureUsageAsSystem(args: {
  clinicId: string;
  featureKey: FeatureKey;
  amount: number;
}): Promise<UsageIncrementResult> {
  if (!isPositiveUsageAmount(args.amount)) return usageError("INVALID_AMOUNT");
  if (!isMeteredFeature(args.featureKey)) return usageError("FEATURE_NOT_METERED");
  if (!args.clinicId) return usageError("FORBIDDEN");
  if (!hasAdminClient()) return usageError(USAGE_RPC_UNAVAILABLE);

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("try_consume_feature_usage", {
    p_clinic_id: args.clinicId,
    p_feature_key: args.featureKey,
    p_amount: args.amount,
  });
  if (error) {
    logServerError("entitlements.try_consume_feature_usage.system", error, {
      clinicId: args.clinicId,
      persist: false,
    });
  }
  return parseUsageRpc(data, error);
}
