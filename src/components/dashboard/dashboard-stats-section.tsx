"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Calendar,
  Users,
  Stethoscope,
  XCircle,
  UserX,
  Search,
  FileText,
  CalendarDays,
} from "lucide-react";
import { StatCard } from "@/components/ui/stat-card";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge, appointmentStatusBadge } from "@/components/ui/badge";
import type {
  DashboardStatKey,
  DashboardStatRow,
  DashboardStatsDetail,
} from "@/lib/utils/dashboard-stats-types";

interface Props {
  detail: DashboardStatsDetail;
}

const PANEL_META: Record<
  DashboardStatKey,
  { title: string; description: string; empty: string; actionHref?: string; actionLabel?: string }
> = {
  today: {
    title: "Turnos de hoy",
    description: "Horario, estado y profesional de cada turno del día.",
    empty: "No hay turnos programados para hoy.",
    actionHref: "/agenda",
    actionLabel: "Ver agenda",
  },
  newPatients: {
    title: "Pacientes nuevos este mes",
    description: "Altas registradas desde el inicio del mes.",
    empty: "No hay pacientes nuevos este mes.",
    actionHref: "/pacientes",
    actionLabel: "Ver pacientes",
  },
  consultations: {
    title: "Consultas realizadas este mes",
    description: "Turnos marcados como atendidos en el mes.",
    empty: "Todavía no hay consultas atendidas este mes.",
    actionHref: "/atenciones",
    actionLabel: "Ver atenciones",
  },
  cancelled: {
    title: "Cancelaciones este mes",
    description: "Turnos cancelados con motivo cuando esté registrado.",
    empty: "No hay cancelaciones este mes.",
    actionHref: "/agenda",
    actionLabel: "Ver agenda",
  },
  noShow: {
    title: "Ausentismo",
    description: "Estadísticas semanal y mensual, y pacientes que no asistieron.",
    empty: "No hay ausencias registradas este mes.",
    actionHref: "/atenciones",
    actionLabel: "Ver atenciones",
  },
};

function statusVariant(statusLabel?: string) {
  const entry = Object.values(appointmentStatusBadge).find((item) => item.label === statusLabel);
  return entry?.variant ?? "default";
}

function StatList({
  rows,
  showStatus,
  showDetail,
  showProfessional,
}: {
  rows: DashboardStatRow[];
  showStatus?: boolean;
  showDetail?: boolean;
  showProfessional?: boolean;
}) {
  return (
    <ul className="max-h-[min(480px,55vh)] space-y-3 overflow-y-auto pr-1">
      {rows.map((row) => (
        <li
          key={row.id}
          className="drflow-card-light flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-sm ring-1 ring-slate-100/80 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold text-slate-900">{row.patientName}</p>
              {showStatus && row.statusLabel ? (
                <Badge variant={statusVariant(row.statusLabel)}>{row.statusLabel}</Badge>
              ) : null}
            </div>
            <p className="mt-0.5 text-xs text-slate-700">
              {row.documentNumber ? `DNI ${row.documentNumber}` : "Sin documento"}
              {row.timeLabel ? ` · ${row.timeLabel}` : ""}
              {row.dateLabel ? ` · ${row.dateLabel}` : ""}
            </p>
            {showProfessional && row.professionalName ? (
              <p className="mt-1 text-xs text-slate-500">Profesional: {row.professionalName}</p>
            ) : null}
            {showDetail && row.detail ? (
              <p className="mt-1 text-xs text-slate-500">Motivo: {row.detail}</p>
            ) : null}
          </div>
          <Link href={row.href}>
            <Button size="sm" variant="outline" type="button">
              <FileText className="h-3.5 w-3.5" />
              Ficha
            </Button>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function AbsenteeismSummary({ detail }: { detail: DashboardStatsDetail }) {
  const { weekly, monthly } = detail.absenteeism;

  return (
    <div className="mb-4 grid gap-3 sm:grid-cols-2">
      <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Semanal</p>
        <p className="mt-1 text-2xl font-bold text-slate-900">{weekly.rate}%</p>
        <p className="mt-1 text-xs text-slate-600">
          {weekly.noShowCount} ausencias de {weekly.totalAppointments} turnos
        </p>
        <p className="mt-0.5 text-xs text-slate-500">{weekly.label}</p>
      </div>
      <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Mensual</p>
        <p className="mt-1 text-2xl font-bold text-slate-900">{monthly.rate}%</p>
        <p className="mt-1 text-xs text-slate-600">
          {monthly.noShowCount} ausencias de {monthly.totalAppointments} turnos
        </p>
        <p className="mt-0.5 text-xs text-slate-500">{monthly.label}</p>
      </div>
    </div>
  );
}

export function DashboardStatsSection({ detail }: Props) {
  const [activeKey, setActiveKey] = useState<DashboardStatKey | null>(null);
  const [query, setQuery] = useState("");

  const toggle = (key: DashboardStatKey) => {
    setActiveKey((current) => (current === key ? null : key));
    setQuery("");
  };

  const activeRows = useMemo((): DashboardStatRow[] => {
    if (!activeKey) return [];
    switch (activeKey) {
      case "today":
        return detail.todayAppointments;
      case "newPatients":
        return detail.newPatients;
      case "consultations":
        return detail.attendedConsultations;
      case "cancelled":
        return detail.cancelledAppointments;
      case "noShow":
        return detail.noShowAppointments;
      default:
        return [];
    }
  }, [activeKey, detail]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return activeRows;
    return activeRows.filter((row) => {
      const blob = `${row.patientName} ${row.documentNumber ?? ""} ${row.detail ?? ""} ${row.professionalName ?? ""}`.toLowerCase();
      return blob.includes(q);
    });
  }, [activeRows, query]);

  const activeMeta = activeKey ? PANEL_META[activeKey] : null;
  const totalForActive =
    activeKey === "today"
      ? detail.counts.todayAppointments
      : activeKey === "newPatients"
        ? detail.counts.newPatients
        : activeKey === "consultations"
          ? detail.counts.completedConsultations
          : activeKey === "cancelled"
            ? detail.counts.cancelledAppointments
            : activeKey === "noShow"
              ? detail.counts.noShowCount
              : 0;

  const { weekly, monthly } = detail.absenteeism;

  return (
    <div className="space-y-4">
      <div className="drflow-bento-stats grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
        <StatCard
          title="Turnos hoy"
          value={detail.counts.todayAppointments}
          icon={<Calendar className="h-5 w-5" />}
          onClick={() => toggle("today")}
          active={activeKey === "today"}
        />
        <StatCard
          title="Pacientes nuevos"
          value={detail.counts.newPatients}
          subtitle="Este mes"
          icon={<Users className="h-5 w-5" />}
          onClick={() => toggle("newPatients")}
          active={activeKey === "newPatients"}
        />
        <StatCard
          title="Consultas realizadas"
          value={detail.counts.completedConsultations}
          subtitle="Este mes"
          icon={<Stethoscope className="h-5 w-5" />}
          onClick={() => toggle("consultations")}
          active={activeKey === "consultations"}
        />
        <StatCard
          title="Cancelaciones"
          value={detail.counts.cancelledAppointments}
          subtitle="Este mes"
          icon={<XCircle className="h-5 w-5" />}
          onClick={() => toggle("cancelled")}
          active={activeKey === "cancelled"}
        />
        <StatCard
          title="Ausentismo"
          value={`${monthly.rate}%`}
          subtitle={`Sem ${weekly.rate}% · ${monthly.noShowCount} ausencias mes`}
          icon={<UserX className="h-5 w-5" />}
          onClick={() => toggle("noShow")}
          active={activeKey === "noShow"}
        />
      </div>

      {activeKey && activeMeta ? (
        <Card
          title={activeMeta.title}
          action={
            activeMeta.actionHref ? (
              <Link href={activeMeta.actionHref}>
                <Button variant="outline" size="sm">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {activeMeta.actionLabel}
                </Button>
              </Link>
            ) : undefined
          }
        >
          <p className="mb-4 text-sm text-slate-600">{activeMeta.description}</p>

          {activeKey === "noShow" ? <AbsenteeismSummary detail={detail} /> : null}

          {activeRows.length === 0 ? (
            <p className="text-sm text-slate-500">{activeMeta.empty}</p>
          ) : (
            <div className="space-y-4">
              <div className="relative max-w-md">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar por nombre, DNI o motivo…"
                  className="pl-9"
                />
              </div>

              <p className="text-xs text-slate-500">
                {filteredRows.length} de {activeRows.length} mostrado(s)
                {totalForActive > activeRows.length
                  ? ` · ${totalForActive} en total (mostrando los últimos ${activeRows.length})`
                  : ""}
              </p>

              <StatList
                rows={filteredRows}
                showStatus={activeKey === "today"}
                showDetail={activeKey === "cancelled"}
                showProfessional={activeKey === "today" || activeKey === "consultations"}
              />
            </div>
          )}
        </Card>
      ) : null}
    </div>
  );
}
