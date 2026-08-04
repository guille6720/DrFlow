"use client";

import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Activity, AlertTriangle, Clock, Database, Server } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CATEGORY_LABELS,
  STATUS_LABELS,
  type ObservabilityCategory,
  type ObservabilityStatus,
} from "@/core/observability/types";
import type { HealthStatus } from "@/core/observability/health";
import type { ObservabilitySnapshot } from "@/lib/server/load-observability";

const STATUS_VARIANT: Record<ObservabilityStatus, "success" | "warning" | "danger" | "info"> = {
  ok: "success",
  warn: "warning",
  error: "danger",
};

type Props = {
  snapshot: ObservabilitySnapshot;
  health: HealthStatus;
};

export function ClinicObservabilityPanel({ snapshot, health }: Props) {
  const { last24h, recentEvents } = snapshot;

  return (
    <Card title="Observabilidad">
      <div className="mb-4 flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
        <Activity className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Logs estructurados, métricas de jobs/API, consultas lentas y errores. Retención 30 días.
          Health check en <code className="rounded bg-white px-1">/api/health</code>.
        </p>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          icon={AlertTriangle}
          label="Errores (24h)"
          value={String(last24h.errors)}
          tone={last24h.errors > 0 ? "danger" : "ok"}
        />
        <StatTile
          icon={Clock}
          label="Consultas lentas"
          value={String(last24h.slowQueries)}
          tone={last24h.slowQueries > 0 ? "warn" : "ok"}
        />
        <StatTile
          icon={Server}
          label="Jobs lentos"
          value={String(last24h.slowJobs)}
          tone={last24h.slowJobs > 0 ? "warn" : "ok"}
        />
        <StatTile
          icon={Database}
          label="Avg job (ms)"
          value={last24h.avgJobDurationMs != null ? String(last24h.avgJobDurationMs) : "—"}
          tone="ok"
        />
      </div>

      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 text-sm">
        <p className="mb-2 font-medium text-slate-900">Estado del sistema</p>
        <ul className="space-y-1 text-slate-600">
          <li>
            Versión {health.version}
            {health.buildId ? ` · build ${health.buildId}` : ""}
          </li>
          <li>
            Supabase: {health.checks.supabase.ok ? "OK" : "Degradado"}
            {health.checks.supabase.latencyMs != null
              ? ` · ${health.checks.supabase.latencyMs} ms`
              : ""}
          </li>
          <li>
            Memoria heap: {health.checks.memory.heapUsedMb} / {health.checks.memory.heapTotalMb} MB
          </li>
          <li>
            Service role: {health.checks.serviceRole.configured ? "configurada" : "no configurada"}
          </li>
        </ul>
      </div>

      <p className="mb-2 text-sm font-medium text-slate-800">Eventos recientes</p>
      {recentEvents.length === 0 ? (
        <p className="text-sm text-slate-500">Sin eventos registrados aún.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {recentEvents.map((ev) => (
            <li key={ev.id} className="flex flex-wrap items-start justify-between gap-2 py-3 text-sm">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-slate-900">{ev.name}</span>
                  <Badge variant="info">{CATEGORY_LABELS[ev.category as ObservabilityCategory]}</Badge>
                  <Badge variant={STATUS_VARIANT[ev.status as ObservabilityStatus]}>
                    {STATUS_LABELS[ev.status as ObservabilityStatus]}
                  </Badge>
                </div>
                <p className="mt-0.5 text-xs text-slate-500">
                  {format(new Date(ev.created_at), "PPp", { locale: es })}
                  {ev.duration_ms != null ? ` · ${ev.duration_ms} ms` : ""}
                  {ev.path ? ` · ${ev.path}` : ""}
                </p>
                {ev.error_message ? (
                  <p className="mt-1 text-xs text-red-600">{ev.error_message}</p>
                ) : null}
              </div>
              {ev.trace_id ? (
                <code className="text-[10px] text-slate-400">{ev.trace_id}</code>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  tone: "ok" | "warn" | "danger";
}) {
  const colors =
    tone === "danger"
      ? "border-red-200 bg-red-50 text-red-900"
      : tone === "warn"
        ? "border-amber-200 bg-amber-50 text-amber-950"
        : "border-slate-200 bg-slate-50 text-slate-900";

  return (
    <div className={`rounded-xl border px-3 py-3 ${colors}`}>
      <div className="flex items-center gap-2 text-xs font-medium opacity-80">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
