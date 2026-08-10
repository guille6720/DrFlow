import type { SupabaseClient } from "@supabase/supabase-js";
import { endOfDay, startOfDay } from "date-fns";

import { observeQuery } from "@/core/observability/observe-query";

import {
  buildAllergiesByPatient,
  buildAppointmentNotifications,
  collectWaitingPatientIds,
  fetchCriticalPatientProfiles,
  filterOverdueAppointments,
  filterWaitingAppointments,
  LIST_LIMIT,
  mapCriticalPatients,
} from "@/features/dashboard/server/load-clinical-operations-dashboard.helpers";
import { APPOINTMENT_SELECT } from "@/features/dashboard/server/load-clinical-operations-dashboard.helpers";
import type { ClinicalOperationsDashboardCorePayload } from "@/features/dashboard/utils/clinical-operations-dashboard-types";
import type { LiveAppointment } from "@/features/dashboard/utils/clinical-operations-types";
import {
  buildActionableAlerts,
  computeActivityMetrics,
  enrichWaitingRows,
} from "@/features/dashboard/utils/clinical-ops-metrics";

/** Above-the-fold dashboard data: today's queue, waiting room, alerts. */
export async function loadClinicalOperationsDashboardCore(
  supabase: SupabaseClient,
  clinicId: string
): Promise<ClinicalOperationsDashboardCorePayload> {
  return observeQuery(
    "load_clinical_operations_dashboard_core",
    clinicId,
    () => loadCoreInner(supabase, clinicId),
    "/dashboard"
  );
}

async function loadCoreInner(
  supabase: SupabaseClient,
  clinicId: string
): Promise<ClinicalOperationsDashboardCorePayload> {
  const now = new Date();
  const nowIso = now.toISOString();
  const todayStart = startOfDay(now).toISOString();
  const todayEnd = endOfDay(now).toISOString();

  const [todayResult, upcomingResult] = await Promise.all([
    supabase
      .from("appointments")
      .select(APPOINTMENT_SELECT)
      .eq("clinic_id", clinicId)
      .gte("start_at", todayStart)
      .lte("start_at", todayEnd)
      .not("status", "eq", "cancelled")
      .order("start_at"),
    supabase
      .from("appointments")
      .select(APPOINTMENT_SELECT)
      .eq("clinic_id", clinicId)
      .gte("start_at", nowIso)
      .not("status", "in", '("cancelled","attended")')
      .order("start_at")
      .limit(LIST_LIMIT),
  ]);

  const todayAppointments = (todayResult.data ?? []) as unknown as LiveAppointment[];
  const upcoming = (upcomingResult.data ?? []) as unknown as LiveAppointment[];
  const waitingPatientIds = collectWaitingPatientIds(todayAppointments);

  const criticalRows = await fetchCriticalPatientProfiles(supabase, clinicId, waitingPatientIds);
  const allergiesByPatient = buildAllergiesByPatient(criticalRows.data ?? [], waitingPatientIds);

  const waiting = filterWaitingAppointments(todayAppointments);
  const overdue = filterOverdueAppointments(todayAppointments, nowIso);
  const notifications = buildAppointmentNotifications(todayAppointments, overdue);
  const criticalPatients = mapCriticalPatients(criticalRows.data ?? []);

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

  const urgentPatients = enrichedWaiting.filter(
    (row) => row.priority === "urgent" || row.priority === "high"
  );

  return {
    waiting,
    upcoming,
    overdue,
    criticalPatients,
    notifications: notifications.slice(0, LIST_LIMIT),
    todayAppointments,
    activity,
    enrichedWaiting,
    actionableAlerts,
    urgentPatients,
  };
}
