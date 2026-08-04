"use client";

import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ListTodo } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ClinicJobStatus } from "@/core/jobs/registry";

type JobRow = {
  id: string;
  jobType: string;
  jobLabel: string;
  status: ClinicJobStatus;
  statusLabel: string;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
};

const STATUS_VARIANT: Record<ClinicJobStatus, "info" | "warning" | "success" | "danger"> = {
  pending: "warning",
  running: "info",
  completed: "success",
  failed: "danger",
  cancelled: "info",
};

type Props = {
  jobs: JobRow[];
};

export function ClinicJobsPanel({ jobs }: Props) {
  return (
    <Card title="Cola de trabajos">
      <div className="mb-4 flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
        <ListTodo className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Procesamiento asíncrono para emails, reportes, importaciones e IA. La interfaz no
          espera — los trabajos se procesan en segundo plano (cron cada minuto en producción).
        </p>
      </div>

      {jobs.length === 0 ? (
        <p className="text-sm text-slate-500">No hay trabajos recientes.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {jobs.map((job) => (
            <li key={job.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-slate-900">{job.jobLabel}</p>
                  <Badge variant={STATUS_VARIANT[job.status]}>{job.statusLabel}</Badge>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {format(new Date(job.createdAt), "PPp", { locale: es })}
                  {job.completedAt
                    ? ` · fin ${format(new Date(job.completedAt), "PPp", { locale: es })}`
                    : null}
                </p>
                {job.errorMessage ? (
                  <p className="mt-1 text-xs text-red-600">{job.errorMessage}</p>
                ) : null}
              </div>
              <code className="text-[10px] text-slate-400">{job.id.slice(0, 8)}…</code>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
