"use client";

import { FileUp, Loader2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { ImportJobsQueuedBanner } from "@/features/integraciones/components/datos/import-jobs-queued-banner";

import { Button } from "@/components/ui/button";
import { PanelShell } from "@/components/ui/panel-shell";
import { enqueueClinicalPdfImports } from "@/lib/actions/import-jobs";
import {
  CLINICAL_DOCUMENT_MAX_BYTES,
  CLINICAL_PDF_IMPORT_MAX_FILES,
} from "@/lib/constants/clinical-documents";

interface Props {
  canImport: boolean;
  embedded?: boolean;
}

export function ImportClinicalPdfPanel({ canImport, embedded }: Props) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [queued, setQueued] = useState<{ count: number; jobIds: string[] } | null>(null);

  if (!canImport) return null;

  async function processFiles(files: FileList | File[]) {
    const list = Array.from(files).filter(
      (file) =>
        file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
    );

    if (list.length === 0) {
      setError("Seleccioná al menos un archivo PDF.");
      return;
    }

    if (list.length > CLINICAL_PDF_IMPORT_MAX_FILES) {
      setError(`Podés importar hasta ${CLINICAL_PDF_IMPORT_MAX_FILES} PDFs por vez.`);
      return;
    }

    const oversized = list.find((file) => file.size > CLINICAL_DOCUMENT_MAX_BYTES);
    if (oversized) {
      setError(`"${oversized.name}" supera el límite de 10 MB.`);
      return;
    }

    setImporting(true);
    setError(null);
    setQueued(null);

    const formData = new FormData();
    list.forEach((file) => formData.append("files", file));

    const result = await enqueueClinicalPdfImports(formData);
    setImporting(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setQueued({ count: result.enqueued ?? list.length, jobIds: result.jobIds ?? [] });
    if (fileInputRef.current) fileInputRef.current.value = "";
    router.refresh();
  }

  return (
    <PanelShell embedded={embedded} title="Importar historias PDF">
      <p className="mb-3 text-sm text-slate-600">
        Subí historias exportadas desde otra app, de a una o en lote. NexClinic detecta el DNI,
        completa datos del paciente y, en PDFs con evoluciones, crea las consultas en historias
        clínicas.
      </p>
      <p className="mb-4 text-xs text-slate-500">
        Los archivos se procesan en cola — la pantalla no se bloquea. Seguí el progreso en
        Configuración → Cola de trabajos.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          className="hidden"
          onChange={(e) => {
            const files = e.target.files;
            if (files?.length) void processFiles(files);
          }}
        />
        <Button
          type="button"
          variant="outline"
          loading={importing}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="h-4 w-4" />
          Elegir PDFs
        </Button>
        <span className="text-xs text-slate-500">
          Hasta {CLINICAL_PDF_IMPORT_MAX_FILES} archivos · 10 MB c/u
        </span>
      </div>

      {importing && (
        <p className="mt-3 flex items-center gap-2 text-sm text-slate-600">
          <Loader2 className="h-4 w-4 animate-spin" />
          Encolando PDFs…
        </p>
      )}

      {queued ? (
        <ImportJobsQueuedBanner enqueued={queued.count} jobIds={queued.jobIds} />
      ) : null}

      {error && (
        <p className="mt-3 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      {!importing && !queued && (
        <div
          className={`mt-4 flex items-center gap-2 rounded-xl border border-dashed px-4 py-6 text-sm transition-colors ${
            dragging
              ? "border-blue-400 bg-blue-50 text-blue-700"
              : "border-slate-200 bg-slate-50/80 text-slate-500"
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            if (e.dataTransfer.files.length) void processFiles(e.dataTransfer.files);
          }}
        >
          <FileUp className="h-5 w-5 shrink-0" />
          Arrastrá PDFs acá o usá el botón para seleccionarlos.
        </div>
      )}

      {!importing && queued && (
        <div className="mt-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setQueued(null);
              fileInputRef.current?.click();
            }}
          >
            Encolar más PDFs
          </Button>
        </div>
      )}
    </PanelShell>
  );
}
