"use client";

import { Download } from "lucide-react";
import { useState } from "react";

import { AddonUpgradeNotice } from "@/core/components/entitlements/addon-upgrade-notice";
import { FEATURES } from "@/core/entitlements/features";

import { exportClinicPatientsSpreadsheet } from "@/features/integraciones/actions/patient-export";
import { downloadBase64File } from "@/features/integraciones/components/datos/download-file";

import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";

type Props = {
  canExport: boolean;
  estimatedCount: number;
  bulk?: boolean;
};

export function PatientExportPanel({ canExport, estimatedCount, bulk }: Props) {
  const [format, setFormat] = useState<"csv" | "xlsx">("csv");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  if (!canExport) {
    return <p className="text-sm text-slate-600">No tenés permiso para exportar pacientes.</p>;
  }

  async function runExport() {
    setBusy(true);
    setError(null);
    const result = await exportClinicPatientsSpreadsheet(format, { bulk });
    setBusy(false);
    if (result.error || !result.base64 || !result.fileName || !result.mime) {
      setError(result.error ?? "No se pudo generar el archivo.");
      return;
    }
    downloadBase64File(result.fileName, result.mime, result.base64);
  }

  return (
    <div className="space-y-3">
      <AddonUpgradeNotice feature={FEATURES.DATA_EXPORT} />
      <p className="text-sm text-slate-600">
        Padrón activo estimado: {estimatedCount} paciente{estimatedCount === 1 ? "" : "s"} (máx. 5000).
        Datos demográficos solamente.
      </p>
      {bulk ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
          Exportación masiva: incluye datos personales de todo el consultorio. Confirmá antes de
          descargar.
        </p>
      ) : null}
      <Select
        label="Formato"
        value={format}
        onChange={(event) => setFormat(event.target.value as "csv" | "xlsx")}
        options={[
          { value: "csv", label: "CSV" },
          { value: "xlsx", label: "Excel" },
        ]}
      />
      {bulk ? (
        <label className="flex items-center gap-2 text-sm text-slate-800">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
          />
          Entiendo que voy a descargar datos sensibles de pacientes.
        </label>
      ) : null}
      <Button
        type="button"
        loading={busy}
        disabled={bulk && !confirmed}
        onClick={() => void runExport()}
      >
        <Download className="h-4 w-4" />
        Descargar
      </Button>
      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
