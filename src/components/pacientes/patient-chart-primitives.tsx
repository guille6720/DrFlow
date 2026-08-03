"use client";

import { useMemo } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import type { PatientChartPayload } from "@/lib/utils/patient-chart-types";

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

export function VitalsSparkline({ vitals }: { vitals: PatientChartPayload["vitals"] }) {
  const points = useMemo(() => {
    const sorted = [...vitals].reverse().slice(-8);
    const weights = sorted.map((v) => v.weightKg).filter((w): w is number => w != null);
    if (weights.length < 2) {
      const sys = sorted.map((v) => v.systolic).filter((s): s is number => s != null);
      return { values: sys, label: "TA sistólica" };
    }
    return { values: weights, label: "Peso (kg)" };
  }, [vitals]);

  if (points.values.length < 2) {
    return <p className="drflow-patient-chart-muted text-xs">Agregá signos vitales para ver evolución.</p>;
  }

  const w = 200;
  const h = 48;
  const min = Math.min(...points.values);
  const max = Math.max(...points.values);
  const range = max - min || 1;
  const coords = points.values
    .map((v, i) => {
      const x = (i / (points.values.length - 1)) * w;
      const y = h - ((v - min) / range) * (h - 8) - 4;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div className="mt-2">
      <p className="drflow-patient-chart-muted mb-1 text-xs">{points.label}</p>
      <svg viewBox={`0 0 ${w} ${h}`} className="h-12 w-full max-w-[240px] text-teal-400" aria-hidden>
        <polyline fill="none" stroke="currentColor" strokeWidth="2" points={coords} />
      </svg>
    </div>
  );
}
