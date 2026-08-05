"use client";

import { AlertTriangle, CheckCircle2 } from "lucide-react";

export function ChartSection({
  title,
  action,
  children,
  className = "",
  id,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={`drflow-patient-chart-section ${className}`}>
      <header className="drflow-patient-chart-section-head">
        <h2>{title}</h2>
        {action}
      </header>
      <div className="drflow-patient-chart-section-body">{children}</div>
    </section>
  );
}

export function AlertBadge({ level, label }: { level: "red" | "yellow" | "green"; label: string }) {
  return <span className={`drflow-chart-alert drflow-chart-alert-${level}`}>{label}</span>;
}

export function VaccineIcon({ status }: { status: "ok" | "warn" | "missing" }) {
  if (status === "ok") return <CheckCircle2 className="h-4 w-4 text-emerald-400" aria-label="Al día" />;
  if (status === "warn") return <AlertTriangle className="h-4 w-4 text-amber-400" aria-label="Pendiente" />;
  return <span className="drflow-patient-chart-muted text-sm" aria-label="Sin dato">—</span>;
}

export function IndicatorChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="drflow-patient-chart-kpi">
      <span className="drflow-patient-chart-kpi-label">{label}</span>
      <span className="drflow-patient-chart-kpi-value">{value}</span>
    </div>
  );
}

export { VitalsSparkline } from "@/features/pacientes/components/pacientes/vitals-sparkline";
