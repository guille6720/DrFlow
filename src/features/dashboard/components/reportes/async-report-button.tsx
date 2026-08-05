"use client";

import { FileSpreadsheet } from "lucide-react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { enqueueOperationalReportJob } from "@/lib/actions/clinic-jobs";

export function AsyncReportButton() {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleEnqueue() {
    setMessage(null);
    startTransition(async () => {
      const result = await enqueueOperationalReportJob();
      if (result.error) {
        setMessage(result.error);
        return;
      }
      setMessage(
        result.jobId
          ? `Reporte en cola (${result.jobId.slice(0, 8)}…). Revisá Configuración → Cola de trabajos.`
          : "Reporte encolado."
      );
    });
  }

  return (
    <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-3">
      <p className="text-sm text-slate-700">
        Generación asíncrona — no bloquea la pantalla mientras se agregan datos del mes.
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <Button size="sm" variant="outline" loading={pending} onClick={handleEnqueue}>
          <FileSpreadsheet className="h-4 w-4" />
          Generar reporte en segundo plano
        </Button>
        {message ? <p className="text-sm text-teal-800">{message}</p> : null}
      </div>
    </div>
  );
}
