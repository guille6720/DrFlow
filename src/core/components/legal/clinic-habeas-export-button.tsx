"use client";

import { Download } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { exportClinicHabeasDataBundle } from "@/lib/actions/compliance";

export function ClinicHabeasExportButton({ clinicSlug }: { clinicSlug?: string | null }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleExport() {
    setLoading(true);
    setError(null);
    const result = await exportClinicHabeasDataBundle();
    setLoading(false);
    if (result.error || !result.json) {
      setError(result.error ?? "No se pudo exportar.");
      return;
    }
    const blob = new Blob([result.json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const label = clinicSlug?.trim() || "clinica";
    a.download = `drflow-habeas-clinica-${label.replace(/\s+/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4">
      <p className="font-semibold text-slate-900">Exportación Habeas Data (clínica)</p>
      <p className="mt-1 text-sm text-slate-600">
        JSON con pacientes, historias, turnos, recetas, órdenes, consentimientos y cobros del
        consultorio activo. Queda registrado en auditoría.
      </p>
      <div className="mt-3">
        <Button type="button" variant="outline" size="sm" loading={loading} onClick={() => void handleExport()}>
          <Download className="h-4 w-4" />
          Exportar clínica (JSON)
        </Button>
      </div>
      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
