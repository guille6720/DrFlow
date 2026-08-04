"use client";

import Link from "next/link";
import {
  Calendar,
  Users,
  Stethoscope,
  XCircle,
  UserX,
  Search,
  CalendarDays,
} from "lucide-react";
import { StatCard } from "@/components/ui/stat-card";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DashboardAbsenteeismSummary } from "@/components/dashboard/dashboard-absenteeism-summary";
import { DashboardStatList } from "@/components/dashboard/dashboard-stat-list";
import { useDashboardStatsSection } from "@/lib/hooks/use-dashboard-stats-section";
import type { DashboardStatsDetail } from "@/lib/utils/dashboard-stats-types";

interface Props {
  detail: DashboardStatsDetail;
}

export function DashboardStatsSection({ detail }: Props) {
  const stats = useDashboardStatsSection({ detail });

  return (
    <div className="space-y-4">
      <div className="drflow-bento-stats grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
        <StatCard
          title="Turnos hoy"
          value={stats.counts.todayAppointments}
          icon={<Calendar className="h-5 w-5" />}
          onClick={() => stats.toggle("today")}
          active={stats.activeKey === "today"}
        />
        <StatCard
          title="Pacientes nuevos"
          value={stats.counts.newPatients}
          subtitle="Este mes"
          icon={<Users className="h-5 w-5" />}
          onClick={() => stats.toggle("newPatients")}
          active={stats.activeKey === "newPatients"}
        />
        <StatCard
          title="Consultas realizadas"
          value={stats.counts.completedConsultations}
          subtitle="Este mes"
          icon={<Stethoscope className="h-5 w-5" />}
          onClick={() => stats.toggle("consultations")}
          active={stats.activeKey === "consultations"}
        />
        <StatCard
          title="Cancelaciones"
          value={stats.counts.cancelledAppointments}
          subtitle="Este mes"
          icon={<XCircle className="h-5 w-5" />}
          onClick={() => stats.toggle("cancelled")}
          active={stats.activeKey === "cancelled"}
        />
        <StatCard
          title="Ausentismo"
          value={`${stats.monthly.rate}%`}
          subtitle={`Sem ${stats.weekly.rate}% · ${stats.monthly.noShowCount} ausencias mes`}
          icon={<UserX className="h-5 w-5" />}
          onClick={() => stats.toggle("noShow")}
          active={stats.activeKey === "noShow"}
        />
      </div>

      {stats.activeKey && stats.activeMeta ? (
        <Card
          title={stats.activeMeta.title}
          action={
            stats.activeMeta.actionHref ? (
              <Link href={stats.activeMeta.actionHref}>
                <Button variant="outline" size="sm">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {stats.activeMeta.actionLabel}
                </Button>
              </Link>
            ) : undefined
          }
        >
          <p className="mb-4 text-sm text-slate-600">{stats.activeMeta.description}</p>

          {stats.activeKey === "noShow" ? <DashboardAbsenteeismSummary detail={detail} /> : null}

          {stats.activeRows.length === 0 ? (
            <p className="text-sm text-slate-500">{stats.activeMeta.empty}</p>
          ) : (
            <div className="space-y-4">
              <div className="relative max-w-md">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={stats.query}
                  onChange={(e) => stats.setQuery(e.target.value)}
                  placeholder="Buscar por nombre, DNI o motivo…"
                  className="pl-9"
                />
              </div>

              <p className="text-xs text-slate-500">
                {stats.filteredRows.length} de {stats.activeRows.length} mostrado(s)
                {stats.totalForActive > stats.activeRows.length
                  ? ` · ${stats.totalForActive} en total (mostrando los últimos ${stats.activeRows.length})`
                  : ""}
              </p>

              <DashboardStatList
                rows={stats.filteredRows}
                showStatus={stats.activeKey === "today"}
                showDetail={stats.activeKey === "cancelled"}
                showProfessional={stats.activeKey === "today" || stats.activeKey === "consultations"}
              />
            </div>
          )}
        </Card>
      ) : null}
    </div>
  );
}
