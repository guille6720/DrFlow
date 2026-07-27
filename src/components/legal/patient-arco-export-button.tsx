"use client";

import { useState } from "react";
import { exportPatientArcoBundle } from "@/lib/actions/compliance";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

export function PatientArcoExportButton({
  patientId,
  fileLabel,
}: {
  patientId: string;
  fileLabel: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleExport() {
    setLoading(true);
    setError(null);
    const result = await exportPatientArcoBundle(patientId);
    setLoading(false);
    if (result.error || !result.json) {
      setError(result.error ?? "No se pudo exportar.");
      return;
    }
    const blob = new Blob([result.json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `drflow-arco-${fileLabel.replace(/\s+/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <Button type="button" variant="outline" size="sm" loading={loading} onClick={() => void handleExport()}>
        <Download className="h-4 w-4" />
        Exportar datos (ARCO)
      </Button>
      {error ? <p className="mt-1 text-xs text-red-400">{error}</p> : null}
    </div>
  );
}
