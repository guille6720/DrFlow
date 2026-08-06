"use server";

import { revalidatePath } from "next/cache";

import { requireStaffManagerWithUser } from "@/core/actions/guard-adapters";

import {
  deleteClinicSharedAiConnection,
  getClinicSharedAiConnectionPublic,
  saveClinicSharedAiConnection,
} from "@/lib/ai/clinic-shared-ai.server";
import type { UserAiProviderId } from "@/lib/ai/user-ai-provider-types";

export async function fetchClinicSharedAiConnectionAction() {
  const access = await requireStaffManagerWithUser();
  if (!access.ok) return null;
  return getClinicSharedAiConnectionPublic();
}

export async function saveClinicSharedAiConnectionAction(input: {
  provider: UserAiProviderId;
  apiKey?: string;
  baseUrl?: string | null;
  model?: string | null;
  label?: string | null;
}) {
  const access = await requireStaffManagerWithUser();
  if (!access.ok) return { error: access.error };

  const result = await saveClinicSharedAiConnection(input);
  if (!result.error) {
    revalidatePath("/configuracion");
  }
  return result;
}

export async function disconnectClinicSharedAiAction() {
  const access = await requireStaffManagerWithUser();
  if (!access.ok) return { error: access.error };

  const result = await deleteClinicSharedAiConnection();
  if (!result.error) {
    revalidatePath("/configuracion");
  }
  return result;
}
