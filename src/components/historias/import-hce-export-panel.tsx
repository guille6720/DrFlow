"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PanelShell } from "@/components/ui/panel-shell";
import { Button } from "@/components/ui/button";
import { HCE_EXPORT_MAX_BYTES } from "@/lib/constants/clinical-documents";
import { enqueueHceImportJob } from "@/lib/actions/import-jobs";
import { ImportJobsQueuedBanner } from "@/components/datos/import-jobs-queued-banner";
import { FileSpreadsheet, Loader2, Upload } from "lucide-react";

interface Props {
  canImport: boolean;
  embedded?: boolean;
}

export function ImportHceExportPanel({ canImport, embedded }: Props) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [queued, setQueued] = useState<{ jobId: string; fileName: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!canImport) return null;

  async function processFile(file: File) {
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setError("Subí el archivo HCE_export.csv.");
      return;
    }
    if (file.size > HCE_EXPORT_MAX_BYTES) {
      setError("El archivo supera 15 MB.");
      return;
    }

    setImporting(true);
    setError(null);
    setQueued(null);

    try {
      const formData = new FormData();
      formData.set("file", file);
      const result = await enqueueHceImportJob(formData);
      if (result.error) {
        setError(result.error);
      } else if (result.jobId) {
        setQueued({ jobId: result.jobId, fileName: file.name });
      }
    } catch {
      setError("Error de conexión al encolar la importación HCE.");
    }

    setImporting(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    router.refresh();
  }

  return (
    <PanelShell embedded={embedded} title="Importar export HCE (CSV)">
      <p className="mb-3 text-sm text-slate-600">
        Subí <code className="rounded bg-slate-100 px-1">HCE_export.csv</code>: crea pacientes si
        no existen (por ID de importación o nombre), registra diagnósticos/tratamientos y deja en cada ficha
        un CSV descargable con su resumen HCE.
      </p>
      <p className="mb-4 text-xs text-slate-500">
        Recomendado importar antes{" "}
        <Link href="/pacientes" className="text-blue-700 hover:underline">
          pacientes consumers
        </Link>{" "}
        para vincular DNI reales. Sin DNI se genera uno interno 90xxxxxxx.
      </p>

      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void processFile(file);
        }}
      />
      <Button
        type="button"
        variant="outline"
        loading={importing}
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload className="h-4 w-4" />
        Subir HCE_export.csv
      </Button>

      {importing && (
        <p className="mt-3 flex items-center gap-2 text-sm text-slate-600">
          <Loader2 className="h-4 w-4 animate-spin" />
          Encolando importación HCE…
        </p>
      )}

      {queued && !importing ? (
        <ImportJobsQueuedBanner enqueued={1} jobIds={[queued.jobId]} />
      ) : null}

      {error && (
        <p className="mt-3 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      {!importing && !queued && !error && (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-6 text-sm text-slate-500">
          <FileSpreadsheet className="h-5 w-5 shrink-0" />
          Subí tu export HCE acá.
        </div>
      )}
    </PanelShell>
  );
}
