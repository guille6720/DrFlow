"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

function formatElapsed(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

interface Props {
  storageKey: string;
  label?: string;
}

export function ConsultationTimer({ storageKey, label = "Tiempo en consulta" }: Props) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const key = `drflow-consultation-${storageKey}`;
    const existing = sessionStorage.getItem(key);
    const startedAt = existing ? Number(existing) : Date.now();
    if (!existing) sessionStorage.setItem(key, String(startedAt));

    const tick = () => setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [storageKey]);

  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-900">
      <Clock className="h-4 w-4" />
      <span>{label}:</span>
      <span className="font-mono tabular-nums">{formatElapsed(elapsed)}</span>
    </div>
  );
}

export function clearConsultationTimer(storageKey: string) {
  sessionStorage.removeItem(`drflow-consultation-${storageKey}`);
}
