"use client";

import { FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { ImportJobsQueuedBanner } from "@/features/integraciones/components/datos/import-jobs-queued-banner";

import { Button } from "@/components/ui/button";
import { PanelShell } from "@/components/ui/panel-shell";
import { enqueueConsumersImportJob } from "@/lib/actions/import-jobs";
import { CONSUMERS_IMPORT_MAX_BYTES } from "@/lib/constants/clinical-documents";

interface Props {
  canImport: boolean;
  embedded?: boolean;
}

const ACCEPT = ".xlsx,.xls,.csv,.csv.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export function ImportConsumersPanel({ canImport, embedded }: Props) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [queued, setQueued] = useState<{ jobId: string; fileName: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!canImport) return null;

  async function processFile(file: File) {
    const lower = file.name.toLowerCase();
    const ok =
      lower.endsWith(".xlsx") ||
      lower.endsWith(".xls") ||
      lower.endsWith(".csv") ||
      lower.endsWith(".csv.xlsx");
    if (!ok) {
      setError("Formato no soportado. Usá el export de pacientes (.xlsx o .csv.xlsx).");
      return;
    }
    if (file.size > CONSUMERS_IMPORT_MAX_BYTES) {
      setError("El archivo supera 15 MB.");
      return;
    }

    setImporting(true);
    setError(null);
    setQueued(null);

    try {
      const formData = new FormData();
      formData.set("file", file);
      const result = await enqueueConsumersImportJob(formData);
      if (result.error) {
        setError(result.error);
      } else if (result.jobId) {
        setQueued({ jobId: result.jobId, fileName: file.name });
      }
    } catch {
      setError("Error de conexión al encolar la importación.");
    }

    setImporting(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    router.refresh();
  }

  return (
    <PanelShell embedded={embedded} title="Importar pacientes (Excel consumers)">
      <p className="mb-3 text-sm text-slate-600">
        Subí el export de residentes/pacientes, por ejemplo{" "}
        <code className="rounded bg-slate-100 px-1">consumers-*.csv.xlsx</code>. NexClinic lee DNI,
        nombre, fecha de nacimiento, teléfono, email y PAMI desde cada fila.
      </p>
      <p className="mb-4 text-xs text-slate-500">
        Archivos grandes se procesan en cola por lotes (sin bloquear la pantalla). Hasta 5000 filas
        · 15 MB.
      </p>

      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPT}
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
        Subir Excel de pacientes
      </Button>

      {importing && (
        <p className="mt-3 flex items-center gap-2 text-sm text-slate-600">
          <Loader2 className="h-4 w-4 animate-spin" />
          Encolando importación…
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
          Arrastrá o elegí tu archivo consumers.
        </div>
      )}
    </PanelShell>
  );
}
