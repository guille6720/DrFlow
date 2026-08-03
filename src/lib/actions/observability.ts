"use server";

import { requireClinicPermission } from "@/lib/actions/clinic-guard";
import { loadObservabilitySnapshot } from "@/lib/server/load-observability";
import { createClient } from "@/lib/supabase/server";
import { getHealthStatus } from "@/lib/observability/health";

export async function getClinicObservabilityDashboard() {
  const access = await requireClinicPermission("manageSettings");
  if (!access.ok) return { error: access.error };

  const supabase = await createClient();
  const [snapshot, health] = await Promise.all([
    loadObservabilitySnapshot(supabase, access.clinicId),
    getHealthStatus(),
  ]);

  return { data: { snapshot, health } };
}
