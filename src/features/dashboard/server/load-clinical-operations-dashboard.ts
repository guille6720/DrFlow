import type { SupabaseClient } from "@supabase/supabase-js";
import { endOfDay, startOfDay } from "date-fns";

import { observeQuery } from "@/core/observability/observe-query";

import {
  buildAllergiesByPatient,
  buildAppointmentNotifications,
  collectWaitingPatientIds,
  fetchCriticalPatientProfiles,
  fetchDashboardPrimaryQueries,
  filterOverdueAppointments,
  filterWaitingAppointments,
  LIST_LIMIT,
  mapCriticalPatients,
  mapDraftPrescriptions,
  mapPendingOrders,
  mapPendingStudies,
  mapQueuedReminders,
} from "@/features/dashboard/server/load-clinical-operations-dashboard.helpers";
import { buildTasks } from "@/features/dashboard/server/load-clinical-operations-dashboard.tasks";
import type { ClinicalOperationsDashboardPayload } from "@/features/dashboard/utils/clinical-operations-dashboard-types";
import type { LiveAppointment } from "@/features/dashboard/utils/clinical-operations-types";
import {
  buildActionableAlerts,
  computeActivityMetrics,
  enrichWaitingRows,
  prioritizeLabResults,
} from "@/features/dashboard/utils/clinical-ops-metrics";

/** Single parallel fetch for the clinical operations dashboard (<2s target). */
export async function loadClinicalOperationsDashboard(
  supabase: SupabaseClient,
  clinicId: string
): Promise<ClinicalOperationsDashboardPayload> {
  return observeQuery(
    "load_clinical_operations_dashboard",
    clinicId,
    () => loadClinicalOperationsDashboardInner(supabase, clinicId),
    "/dashboard"
  );
}

async function loadClinicalOperationsDashboardInner(
  supabase: SupabaseClient,
  clinicId: string
): Promise<ClinicalOperationsDashboardPayload> {
  const now = new Date();
  const nowIso = now.toISOString();
  const todayStart = startOfDay(now).toISOString();
  const todayEnd = endOfDay(now).toISOString();
  const studiesSince = new Date(Date.now() - 7 * 86400000).toISOString();

  const [
    todayResult,
    upcomingResult,
    draftRx,
    pendingStudies,
    queuedReminders,
    pendingOrdersResult,
  ] = await fetchDashboardPrimaryQueries(
    supabase,
    clinicId,
    todayStart,
    todayEnd,
    nowIso,
    studiesSince
  );

  const todayAppointments = (todayResult.data ?? []) as unknown as LiveAppointment[];
  const upcoming = (upcomingResult.data ?? []) as unknown as LiveAppointment[];

  const patientIds = [
    ...new Set(todayAppointments.map((a) => a.patient_id).filter((id): id is string => Boolean(id))),
  ];
  const waitingPatientIds = collectWaitingPatientIds(todayAppointments);
  const allergyPatientIds = [...new Set([...patientIds, ...waitingPatientIds])];

  const criticalRows = await fetchCriticalPatientProfiles(supabase, clinicId, allergyPatientIds);
  const allergiesByPatient = buildAllergiesByPatient(criticalRows.data ?? [], waitingPatientIds);

  const waiting = filterWaitingAppointments(todayAppointments);
  const overdue = filterOverdueAppointments(todayAppointments, nowIso);
  const notifications = buildAppointmentNotifications(todayAppointments, overdue);
  const criticalPatients = mapCriticalPatients(criticalRows.data ?? []);
  const draftPrescriptions = mapDraftPrescriptions(draftRx.data ?? []);
  const pendingStudiesMapped = mapPendingStudies(pendingStudies.data ?? []);
  const queuedRemindersMapped = mapQueuedReminders(queuedReminders.data ?? []);
  const pendingOrders = mapPendingOrders(pendingOrdersResult.data ?? []);

  const tasks = buildTasks({
    todayAppointments,
    nowIso,
    draftPrescriptions,
    pendingStudies: pendingStudiesMapped,
    queuedReminders: queuedRemindersMapped,
  });

  const enrichedWaiting = enrichWaitingRows({
    waiting: waiting as LiveAppointment[],
    allergiesByPatient,
    now,
  });

  const activity = computeActivityMetrics({
    todayAppointments,
    waiting: waiting as LiveAppointment[],
    now,
  });

  const actionableAlerts = buildActionableAlerts({
    criticalPatients,
    overdue: overdue as LiveAppointment[],
    enrichedWaiting,
  });

  const recentLabs = prioritizeLabResults(pendingStudiesMapped, now);
  const urgentPatients = enrichedWaiting.filter(
    (row) => row.priority === "urgent" || row.priority === "high"
  );

  return {
    waiting,
    upcoming,
    overdue,
    draftPrescriptions,
    pendingStudies: pendingStudiesMapped,
    criticalPatients,
    notifications: notifications.slice(0, LIST_LIMIT),
    todayAppointments,
    tasks,
    activity,
    enrichedWaiting,
    actionableAlerts,
    pendingOrders,
    recentLabs,
    urgentPatients,
  };
}
