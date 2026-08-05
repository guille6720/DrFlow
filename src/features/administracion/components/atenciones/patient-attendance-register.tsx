import { Building2, CalendarDays, Monitor, Users, Video } from "lucide-react";
import Link from "next/link";

import type { PageMeta } from "@/core/supabase/pagination";

import { formatClinicDateTime } from "@/shared/utils/clinic-timezone";

import { ExportCsvButton } from "@/features/dashboard/components/reportes/export-csv-button";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ListPagination, ListPaginationLabel } from "@/components/ui/list-pagination";
import { StatCard } from "@/components/ui/stat-card";
import {
  consultationModalityLabel,
} from "@/lib/constants/consultation-modality";
import type {
  AttendanceListItem,
  AttendancePeriod,
  AttendanceSummary,
} from "@/lib/utils/attendance-stats";

interface Props {
  period: AttendancePeriod;
  periodLabel: string;
  summary: AttendanceSummary;
  items: AttendanceListItem[];
  pageMeta?: PageMeta;
  buildPageHref?: (page: number) => string;
}

const PERIOD_TABS: { id: AttendancePeriod; label: string }[] = [
  { id: "daily", label: "Hoy" },
  { id: "weekly", label: "Semana" },
  { id: "monthly", label: "Mes" },
];

export function PatientAttendanceRegister({
  period,
  periodLabel,
  summary,
  items,
  pageMeta,
  buildPageHref,
}: Props) {
  const csvRows = [
    ["Fecha", "Paciente", "Profesional", "Modalidad", "Cobertura"],
    ...items.map((item) => [
      formatClinicDateTime(item.start_at, "PPp"),
      item.patientName,
      item.professionalName,
      consultationModalityLabel(item.consultation_modality),
      item.coverage ?? "Sin cobertura",
    ]),
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {PERIOD_TABS.map((tab) => (
            <Link key={tab.id} href={`/atenciones?period=${tab.id}`}>
              <Button
                type="button"
                size="sm"
                variant={period === tab.id ? "primary" : "outline"}
              >
                {tab.label}
              </Button>
            </Link>
          ))}
        </div>
        {items.length > 0 && (
          <ExportCsvButton
            rows={csvRows}
            filename={`atenciones-${period}-${periodLabel.replace(/\s+/g, "-")}.csv`}
          />
        )}
      </div>

      <p className="text-sm text-slate-600">
        Período: <span className="font-medium capitalize text-slate-900">{periodLabel}</span>
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Atenciones totales"
          value={summary.total}
          subtitle={`${summary.uniquePatients} paciente(s) distinto(s)`}
          icon={<Users className="h-5 w-5" />}
        />
        <StatCard
          title="Presencial"
          value={summary.presencial}
          subtitle={
            summary.total > 0
              ? `${Math.round((summary.presencial / summary.total) * 100)}% del total`
              : undefined
          }
          icon={<Building2 className="h-5 w-5" />}
        />
        <StatCard
          title="Virtual"
          value={summary.virtual}
          subtitle={
            summary.total > 0
              ? `${Math.round((summary.virtual / summary.total) * 100)}% del total`
              : undefined
          }
          icon={<Video className="h-5 w-5" />}
        />
        <StatCard
          title="Pacientes únicos"
          value={summary.uniquePatients}
          subtitle="En el período seleccionado"
          icon={<CalendarDays className="h-5 w-5" />}
        />
      </div>

      {summary.byCoverage.length > 0 && (
        <Card title="Resumen por cobertura">
          <ul className="flex flex-wrap gap-2">
            {summary.byCoverage.map((row) => (
              <li key={row.coverage}>
                <Badge variant="default">
                  {row.coverage}: {row.count}
                </Badge>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card title="Detalle de atenciones">
        {items.length === 0 ? (
          <p className="text-sm text-slate-500">
            No hay pacientes atendidos en este período. Marcá turnos como{" "}
            <strong>Atendido</strong> desde la agenda o finalizá una consulta en Historia clínica.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {items.map((item) => {
              const isVirtual = item.consultation_modality === "virtual";
              return (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/pacientes/${item.patientId}`}
                      className="font-medium text-blue-700 hover:underline"
                    >
                      {item.patientName}
                    </Link>
                    <p className="text-slate-500">
                      {formatClinicDateTime(item.start_at, "PPp")}
                      {" · "}
                      {item.professionalName}
                      {item.coverage ? ` · ${item.coverage}` : ""}
                    </p>
                  </div>
                  <Badge variant={isVirtual ? "teal" : "default"}>
                    {isVirtual ? (
                      <span className="inline-flex items-center gap-1">
                        <Monitor className="h-3 w-3" />
                        {consultationModalityLabel(item.consultation_modality)}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        {consultationModalityLabel(item.consultation_modality)}
                      </span>
                    )}
                  </Badge>
                </li>
              );
            })}
          </ul>
        )}
        {pageMeta && pageMeta.totalPages > 1 && buildPageHref && (
          <ListPagination className="mt-4">
            {pageMeta.page > 1 ? (
              <Link href={buildPageHref(pageMeta.page - 1)}>
                <Button type="button" size="sm" variant="outline">
                  Anterior
                </Button>
              </Link>
            ) : null}
            <ListPaginationLabel
              current={pageMeta.page}
              totalPages={pageMeta.totalPages}
              suffix={`${pageMeta.total} atenciones`}
            />
            {pageMeta.page < pageMeta.totalPages ? (
              <Link href={buildPageHref(pageMeta.page + 1)}>
                <Button type="button" size="sm" variant="outline">
                  Siguiente
                </Button>
              </Link>
            ) : null}
          </ListPagination>
        )}
      </Card>
    </div>
  );
}
