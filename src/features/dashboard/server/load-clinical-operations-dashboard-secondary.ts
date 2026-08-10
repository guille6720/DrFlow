import type { SupabaseClient } from "@supabase/supabase-js";
import { startOfDay } from "date-fns";

import { observeQuery } from "@/core/observability/observe-query";

import {
  fetchDashboardSecondaryQueries,
  mapDraftPrescriptions,
  mapPendingOrders,
  mapPendingStudies,
  mapQueuedReminders,
} from "@/features/dashboard/server/load-clinical-operations-dashboard.helpers";
import { buildTasks } from "@/features/dashboard/server/load-clinical-operations-dashboard.tasks";
import type {
  ClinicalOperationsDashboardCorePayload,
  ClinicalOperationsDashboardSecondaryPayload,
} from "@/features/dashboard/utils/clinical-operations-dashboard-types";
import type { LiveAppointment } from "@/features/dashboard/utils/clinical-operations-types";
import { prioritizeLabResults } from "@/features/dashboard/utils/clinical-ops-metrics";

/** Below-the-fold widgets: drafts, orders, labs, tasks. */
export async function loadClinicalOperationsDashboardSecondary(
  supabase: SupabaseClient,
  clinicId: string,
  core: ClinicalOperationsDashboardCorePayload
): Promise<ClinicalOperationsDashboardSecondaryPayload> {
  return observeQuery(
    "load_clinical_operations_dashboard_secondary",
    clinicId,
    () => loadSecondaryInner(supabase, clinicId, core),
    "/dashboard"
  );
}

async function loadSecondaryInner(
  supabase: SupabaseClient,
  clinicId: string,
  core: ClinicalOperationsDashboardCorePayload
): Promise<ClinicalOperationsDashboardSecondaryPayload> {
  const now = new Date();
  const todayStart = startOfDay(now).toISOString();
  const studiesSince = new Date(Date.now() - 7 * 86400000).toISOString();

  const [draftRx, pendingStudies, queuedReminders, pendingOrdersResult] =
    await fetchDashboardSecondaryQueries(supabase, clinicId, todayStart, studiesSince);

  const draftPrescriptions = mapDraftPrescriptions(draftRx.data ?? []);
  const pendingStudiesMapped = mapPendingStudies(pendingStudies.data ?? []);
  const queuedRemindersMapped = mapQueuedReminders(queuedReminders.data ?? []);
  const pendingOrders = mapPendingOrders(pendingOrdersResult.data ?? []);

  const tasks = buildTasks({
    todayAppointments: core.todayAppointments as LiveAppointment[],
    nowIso: now.toISOString(),
    draftPrescriptions,
    pendingStudies: pendingStudiesMapped,
    queuedReminders: queuedRemindersMapped,
  });

  const recentLabs = prioritizeLabResults(pendingStudiesMapped, now);

  return {
    draftPrescriptions,
    pendingStudies: pendingStudiesMapped,
    tasks,
    pendingOrders,
    recentLabs,
  };
}
