import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge, appointmentStatusBadge } from "@/components/ui/badge";
import type { DashboardStatRow } from "@/lib/utils/dashboard-stats-types";
import { FileText } from "lucide-react";

function statusVariant(statusLabel?: string) {
  const entry = Object.values(appointmentStatusBadge).find((item) => item.label === statusLabel);
  return entry?.variant ?? "default";
}

interface Props {
  rows: DashboardStatRow[];
  showStatus?: boolean;
  showDetail?: boolean;
  showProfessional?: boolean;
}

export function DashboardStatList({ rows, showStatus, showDetail, showProfessional }: Props) {
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
