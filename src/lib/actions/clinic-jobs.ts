"use server";

import { revalidatePath } from "next/cache";

import { requireClinicPermission } from "@/core/actions/clinic-guard";
import { logAudit } from "@/core/auth/session.actions";
import { getSession } from "@/core/auth/session.server";
import { assertClinicJobEnqueueAllowed } from "@/core/entitlements/clinic-job-guard.server";
import { scheduleAfterTask } from "@/core/errors/background.server";
import { logServerError } from "@/core/errors/log-error.server";
import { enqueueClinicJob } from "@/core/jobs/enqueue";
import { processPendingClinicJobs } from "@/core/jobs/process";
import type { ClinicJobStatus } from "@/core/jobs/registry";
import {
  type ClinicJobType,
  getClinicJobDefinition,
  JOB_STATUS_LABELS,
  listClinicJobTypes,
} from "@/core/jobs/registry";
import { createClient } from "@/core/supabase/server";
import { validateClinicJobEnqueue } from "@/core/validations/clinic-jobs";
import { parseEntityId } from "@/core/validations/params";

export async function enqueueClinicJobAction(
  jobType: ClinicJobType,
  payload: Record<string, unknown>
): Promise<{ success?: true; jobId?: string; error?: string }> {
  const access = await requireClinicPermission("manageAppointments");
  if (!access.ok) return { error: access.error };

  const validated = validateClinicJobEnqueue(jobType, payload);
  if (!validated.ok) return { error: validated.error };

  getClinicJobDefinition(validated.jobType);

  const user = await getSession();
  const supabase = await createClient();

  const guard = await assertClinicJobEnqueueAllowed({
    clinicId: access.clinicId,
    jobType: validated.jobType,
    payload: validated.payload,
    supabase,
  });
  if (!guard.ok) return { error: guard.error };

  try {
    const { id } = await enqueueClinicJob(supabase, {
      clinicId: access.clinicId,
      jobType: validated.jobType,
      payload: validated.payload,
      createdBy: user?.id,
    });

    await logAudit({
      clinicId: access.clinicId,
      entityType: "clinic_job",
      action: "create",
      metadata: { job_id: id, job_type: validated.jobType },
    });

    scheduleAfterTask(
      "clinic-jobs.background-process",
      () => processPendingClinicJobs({ limit: 5, clinicId: access.clinicId }),
      { clinicId: access.clinicId }
    );

    revalidatePath("/configuracion");
    revalidatePath("/recordatorios");

    return { success: true, jobId: id };
  } catch (err) {
    logServerError("clinic-jobs.enqueue", err, { clinicId: access.clinicId });
    return { error: err instanceof Error ? err.message : "No se pudo encolar" };
  }
}

export async function getClinicJob(jobId: string): Promise<{
  data?: {
    id: string;
    jobType: ClinicJobType;
    status: ClinicJobStatus;
    statusLabel: string;
    errorMessage: string | null;
    result: Record<string, unknown> | null;
    createdAt: string;
    completedAt: string | null;
  };
  error?: string;
}> {
  const access = await requireClinicPermission("manageAppointments");
  if (!access.ok) return { error: access.error };

  const idParsed = parseEntityId(jobId, "Trabajo");
  if (!idParsed.ok) return { error: idParsed.error };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clinic_jobs")
    .select("id, job_type, status, error_message, result, created_at, completed_at")
    .eq("id", idParsed.data)
    .eq("clinic_id", access.clinicId)
    .maybeSingle();

  if (error || !data) return { error: "Trabajo no encontrado" };

  return {
    data: {
      id: data.id,
      jobType: data.job_type as ClinicJobType,
      status: data.status as ClinicJobStatus,
      statusLabel: JOB_STATUS_LABELS[data.status as ClinicJobStatus] ?? data.status,
      errorMessage: data.error_message,
      result: (data.result as Record<string, unknown> | null) ?? null,
      createdAt: data.created_at,
      completedAt: data.completed_at,
    },
  };
}

export async function getClinicJobsList(): Promise<{
  data?: Array<{
    id: string;
    jobType: ClinicJobType;
    jobLabel: string;
    status: ClinicJobStatus;
    statusLabel: string;
    errorMessage: string | null;
    createdAt: string;
    completedAt: string | null;
  }>;
  error?: string;
}> {
  const access = await requireClinicPermission("manageSettings");
  if (!access.ok) return { error: access.error };

  const supabase = await createClient();
  const { data } = await supabase
    .from("clinic_jobs")
    .select("id, job_type, status, error_message, created_at, completed_at")
    .eq("clinic_id", access.clinicId)
    .order("created_at", { ascending: false })
    .limit(30);

  const typeLabels = new Map(listClinicJobTypes().map((t) => [t.id, t.label]));

  return {
    data: (data ?? []).map((row) => ({
      id: row.id,
      jobType: row.job_type as ClinicJobType,
      jobLabel: typeLabels.get(row.job_type as ClinicJobType) ?? row.job_type,
      status: row.status as ClinicJobStatus,
      statusLabel: JOB_STATUS_LABELS[row.status as ClinicJobStatus] ?? row.status,
      errorMessage: row.error_message,
      createdAt: row.created_at,
      completedAt: row.completed_at,
    })),
  };
}

export async function enqueueOperationalReportJob(): Promise<{
  success?: true;
  jobId?: string;
  error?: string;
}> {
  const access = await requireClinicPermission("viewReports");
  if (!access.ok) return { error: access.error };

  const now = new Date();
  const { startOfMonth, endOfMonth, format } = await import("date-fns");
  const { es } = await import("date-fns/locale");

  return enqueueClinicJobAction("generate_report", {
    periodStart: startOfMonth(now).toISOString(),
    periodEnd: endOfMonth(now).toISOString(),
    periodLabel: format(now, "MMMM yyyy", { locale: es }),
  });
}
