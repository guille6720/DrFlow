"use client";

import { Download } from "lucide-react";
import { useEffect, useState } from "react";

import {
  enqueueBulkClinicalExport,
  getBulkClinicalExportJob,
  previewBulkClinicalExport,
} from "@/features/integraciones/actions/bulk-clinical-export";
import {
  BulkClinicalExportFilters,
  type BulkExportDraft,
  EMPTY_BULK_EXPORT_DRAFT,
} from "@/features/integraciones/components/datos/bulk-clinical-export-filters";
import { downloadFromUrl } from "@/features/integraciones/components/datos/download-file";
import { ImportJobsQueuedBanner } from "@/features/integraciones/components/datos/import-jobs-queued-banner";

import { Button } from "@/components/ui/button";

type Props = {
  canExport: boolean;
  estimatedCount: number;
  professionals: Array<{ id: string; name: string }>;
  insuranceOptions: string[];
};

function payloadFromDraft(draft: BulkExportDraft, confirmed: boolean) {
  return {
    format: draft.format,
    scope: draft.scope,
    patientIds: draft.scope === "selected" ? draft.patientIds : [],
    sections: draft.sections,
    dateFrom: draft.rangeMode === "custom" ? draft.dateFrom : null,
    dateTo: draft.rangeMode === "custom" ? draft.dateTo : null,
    professionalId: draft.professionalId || null,
    insuranceProvider: draft.insuranceProvider || null,
    confirmed,
  };
}

export function BulkClinicalExportPanel({
  canExport,
  estimatedCount,
  professionals,
  insuranceOptions,
}: Props) {
  const [draft, setDraft] = useState<BulkExportDraft>(EMPTY_BULK_EXPORT_DRAFT);
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ count: number; cap: number; truncated: boolean } | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobNote, setJobNote] = useState<string | null>(null);

  useEffect(() => {
    if (!jobId) return;
    let cancelled = false;
    const timer = window.setInterval(() => {
      void getBulkClinicalExportJob(jobId).then(async (result) => {
        if (cancelled || result.error) return;
        if (result.status === "failed") {
          setJobNote(result.errorMessage ?? "La exportación masiva falló.");
          window.clearInterval(timer);
          return;
        }
        if (result.status === "completed" && result.url && result.fileName) {
          window.clearInterval(timer);
          setJobNote(
            `Listo: ${result.patientCount ?? "—"} pacientes, ${result.recordCount ?? "—"} registros.`
          );
          await downloadFromUrl(result.fileName, result.url);
        }
      });
    }, 2500);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [jobId]);

  if (!canExport) {
    return <p className="text-sm text-slate-600">Solo administración puede hacer una exportación masiva.</p>;
  }

  async function runPreview() {
    setBusy(true);
    setError(null);
    const result = await previewBulkClinicalExport(payloadFromDraft(draft, false));
    setBusy(false);
    if (result.error || result.count == null || result.cap == null) {
      setError(result.error ?? "No se pudo estimar el padrón.");
      setPreview(null);
      return;
    }
    setPreview({ count: result.count, cap: result.cap, truncated: Boolean(result.truncated) });
  }

  async function runExport() {
    setBusy(true);
    setError(null);
    const result = await enqueueBulkClinicalExport(payloadFromDraft(draft, true));
    setBusy(false);
    if (result.error || !result.jobId) {
      setError(result.error ?? "No se pudo encolar la exportación.");
      return;
    }
    setJobId(result.jobId);
    setJobNote("Exportación en cola. El archivo se descarga al terminar.");
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">
        Padrón activo estimado: {estimatedCount} paciente{estimatedCount === 1 ? "" : "s"}. El archivo se
        arma en segundo plano; no se envía al navegador hasta estar listo.
      </p>
      <BulkClinicalExportFilters
        draft={draft}
        onChange={(next) => {
          setDraft(next);
          setPreview(null);
        }}
        professionals={professionals}
        insuranceOptions={insuranceOptions}
      />
      <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
        Incluye datos clínicos y personales del consultorio. Confirmá antes de generar el archivo.
      </p>
      {preview ? (
        <p className="text-sm text-slate-700">
          Se exportarán {preview.count} paciente{preview.count === 1 ? "" : "s"} (tope {preview.cap}
          {preview.truncated ? ", padrón recortado" : ""}).
        </p>
      ) : null}
      <label className="flex items-center gap-2 text-sm text-slate-800">
        <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
        Entiendo que voy a descargar datos sensibles de pacientes.
      </label>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" loading={busy} disabled={draft.sections.length === 0} onClick={() => void runPreview()}>
          Estimar
        </Button>
        <Button
          type="button"
          loading={busy}
          pendingLabel="Encolando..."
          disabled={!confirmed || draft.sections.length === 0}
          onClick={() => void runExport()}
        >
          <Download className="h-4 w-4" />
          Generar exportación
        </Button>
      </div>
      {jobId ? <ImportJobsQueuedBanner enqueued={1} jobIds={[jobId]} /> : null}
      {jobNote ? <p className="text-sm text-slate-700">{jobNote}</p> : null}
      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
