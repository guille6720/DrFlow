"use client";

import { useMemo } from "react";

import type { PatientChartPayload } from "@/features/pacientes/utils/patient-chart-model-types";

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
