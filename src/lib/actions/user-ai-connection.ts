"use server";

import { revalidatePath } from "next/cache";

import { requireAddonFeatureAccess } from "@/core/entitlements/entitlements.server";
import { FEATURES } from "@/core/entitlements/features";

import {
  deleteUserAiConnection,
  getUserAiConnectionPublic,
  saveUserAiConnection,
} from "@/lib/ai/user-ai-credentials.server";
import type { UserAiProviderId } from "@/lib/ai/user-ai-provider-types";

export async function fetchUserAiConnectionAction() {
  return getUserAiConnectionPublic();
}

export async function saveUserAiConnectionAction(input: {
  provider: UserAiProviderId;
  apiKey?: string;
  baseUrl?: string | null;
  model?: string | null;
  label?: string | null;
}) {
  const entitlement = await requireAddonFeatureAccess(FEATURES.AI);
  if (!entitlement.ok) return { error: entitlement.error };

  const result = await saveUserAiConnection(input);
  if (!result.error) {
    revalidatePath("/configuracion");
  }
  return result;
}

export async function disconnectUserAiAction() {
  const result = await deleteUserAiConnection();
  if (!result.error) {
    revalidatePath("/configuracion");
  }
  return result;
}
